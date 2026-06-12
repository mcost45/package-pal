/* eslint import-x/extensions: 0 */
import {
	rmSync, mkdirSync,
} from 'fs';
import { join } from 'path';
import type { PackageData } from '@package-pal/core';
import {
	describe, test, expect, afterAll, beforeEach,
} from 'bun:test';
import { MsbuildAdapter } from '../src/lib/msbuild-adapter';

describe('MSBuild Property Engine & Indirection Support', () => {
	const tempDir = join(import.meta.dir, 'temp-test-properties');

	beforeEach(() => {
		rmSync(tempDir, {
			recursive: true,
			force: true,
		});
		mkdirSync(tempDir, { recursive: true });
		mkdirSync(join(tempDir, 'src/MyLib'), { recursive: true });
		mkdirSync(join(tempDir, 'src/MyConsumer'), { recursive: true });
	});

	afterAll(() => {
		rmSync(tempDir, {
			recursive: true,
			force: true,
		});
	});

	test('Successfully resolves versions backed by external and local MSBuild properties', async () => {
		const adapter = new MsbuildAdapter();

		const versionsPropsPath = join(tempDir, 'src/Versions.props');
		const projPath = join(tempDir, 'src/MyLib/MyLib.csproj');

		const versionsPropsContent = `
<Project>
  <PropertyGroup>
    <PreciPoint_Ims_Core_JwtBearer_Version>4.5.6</PreciPoint_Ims_Core_JwtBearer_Version>
  </PropertyGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(PreciPoint_Ims_Core_JwtBearer_Version)</Version>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(versionsPropsPath, versionsPropsContent);
		await Bun.write(projPath, projContent);

		// Run scanning with relative glob pattern and cwd
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyLib/MyLib.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);
		const pkg = packages[0];
		expect(pkg).toBeDefined();
		if (pkg) {
			expect(pkg.name).toBe('MyLib');
			expect(pkg.version).toBe('4.5.6'); // Should resolve correctly to 4.5.6!
		}
	});

	test('Bumping a property-backed project updates the .props file and leaves the .csproj untouched', async () => {
		const adapter = new MsbuildAdapter();

		const versionsPropsPath = join(tempDir, 'src/Versions.props');
		const projPath = join(tempDir, 'src/MyLib/MyLib.csproj');

		const versionsPropsContent = `
<Project>
  <PropertyGroup>
    <PreciPoint_Ims_Core_JwtBearer_Version>4.5.6</PreciPoint_Ims_Core_JwtBearer_Version>
  </PropertyGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(PreciPoint_Ims_Core_JwtBearer_Version)</Version>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(versionsPropsPath, versionsPropsContent);
		await Bun.write(projPath, projContent);

		// Run scanning first to populate property cache
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyLib/MyLib.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);
		const pkg = packages[0];
		expect(pkg).toBeDefined();
		if (pkg) {
			// Now bump the project version
			await adapter.bumpOwnVersion(pkg, '5.0.0');

			// 1. Verify the Versions.props file has been updated
			const updatedProps = await Bun.file(versionsPropsPath).text();
			expect(updatedProps).toContain('<PreciPoint_Ims_Core_JwtBearer_Version>5.0.0</PreciPoint_Ims_Core_JwtBearer_Version>');

			// 2. Verify the .csproj file is untouched and still points to the property
			const updatedProj = await Bun.file(projPath).text();
			expect(updatedProj).toContain('<Version>$(PreciPoint_Ims_Core_JwtBearer_Version)</Version>');
			expect(updatedProj).not.toContain('<Version>5.0.0</Version>');
		}
	});

	test('Bumping a property-backed consumer dependency routes update to the backing property file and preserves consumer XML', async () => {
		const adapter = new MsbuildAdapter();

		const versionsPropsPath = join(tempDir, 'src/Versions.props');
		const cpmPath = join(tempDir, 'src/Directory.Packages.props');
		const consumerProjPath = join(tempDir, 'src/MyConsumer/MyConsumer.csproj');

		const versionsPropsContent = `
<Project>
  <PropertyGroup>
    <PreciPoint_Ims_Core_JwtBearer_Version>5.0.0</PreciPoint_Ims_Core_JwtBearer_Version>
  </PropertyGroup>
</Project>
		`;

		const cpmContent = `
<Project>
  <ItemGroup>
    <PackageVersion Include="MyLib" Version="$(PreciPoint_Ims_Core_JwtBearer_Version)" />
  </ItemGroup>
</Project>
		`;

		const consumerProjContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyLib" />
  </ItemGroup>
</Project>
		`;

		await Bun.write(versionsPropsPath, versionsPropsContent);
		await Bun.write(cpmPath, cpmContent);
		await Bun.write(consumerProjPath, consumerProjContent);

		// Scan consumer project and MyLib project
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyConsumer/MyConsumer.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);

		const consumerPackageData = packages[0];
		expect(consumerPackageData).toBeDefined();
		if (consumerPackageData) {
			// Bump dependency MyLib in MyConsumer
			const success = await adapter.bumpDependencyVersion(
				consumerPackageData, 'MyLib', '6.0.0', true,
			);
			expect(success).toBe(true);

			// 1. Verify property backing file has been updated
			const updatedProps = await Bun.file(versionsPropsPath).text();
			expect(updatedProps).toContain('<PreciPoint_Ims_Core_JwtBearer_Version>6.0.0</PreciPoint_Ims_Core_JwtBearer_Version>');

			// 2. Verify CPM file is untouched (retains the property reference)
			const updatedCpm = await Bun.file(cpmPath).text();
			expect(updatedCpm).toContain('<PackageVersion Include="MyLib" Version="$(PreciPoint_Ims_Core_JwtBearer_Version)" />');
			expect(updatedCpm).not.toContain('6.0.0');
		}
	});

	test('Successfully resolves and bumps properties with mixed or non-matching casing (case-insensitivity support)', async () => {
		const adapter = new MsbuildAdapter();

		const versionsPropsPath = join(tempDir, 'src/Versions_Casing.props');
		const projPath = join(tempDir, 'src/MyLib_Casing.csproj');

		// Declared as UPPERCASE version name
		const versionsPropsContent = `
<Project>
  <PropertyGroup>
    <PRECIPOINT_IMS_CORE_JWTBEARER_VERSION>4.5.6</PRECIPOINT_IMS_CORE_JWTBEARER_VERSION>
  </PropertyGroup>
</Project>
		`;

		// Used as lowercase version reference
		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(precipoint_ims_core_jwtbearer_version)</Version>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(versionsPropsPath, versionsPropsContent);
		await Bun.write(projPath, projContent);

		// Run scanning with relative glob pattern and cwd
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyLib_Casing.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);
		const pkg = packages[0];
		expect(pkg).toBeDefined();
		if (pkg) {
			expect(pkg.name).toBe('MyLib_Casing');
			// Case-insensitive lookup should resolve correctly to 4.5.6
			expect(pkg.version).toBe('4.5.6');

			// Bump own version to 5.1.0 using mixed-case
			await adapter.bumpOwnVersion(pkg, '5.1.0');

			// Verify backing property file updated regardless of casing match
			const updatedProps = await Bun.file(versionsPropsPath).text();
			expect(updatedProps).toContain('<PRECIPOINT_IMS_CORE_JWTBEARER_VERSION>5.1.0</PRECIPOINT_IMS_CORE_JWTBEARER_VERSION>');
		}
	});

	test('Successfully resolves and bumps exact-pinned CPM-delegated versions when .csproj has no inline Version tag', async () => {
		const adapter = new MsbuildAdapter();

		const cpmPath = join(tempDir, 'src/Directory.Packages.props');
		const projPath = join(tempDir, 'src/MyLib/MyNoVersionLib.csproj');

		// Create a mock CPM file containing an exact-pinned [1.2.3] version for MyNoVersionLib
		const cpmContent = `
<Project>
  <ItemGroup>
    <PackageVersion Include="MyNoVersionLib" Version="[1.2.3]" />
  </ItemGroup>
</Project>
		`;

		// Create a mock project file with no <Version> or <VersionPrefix> tag
		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>MyNoVersionLib</AssemblyName>
    <TargetFramework>net10.0</TargetFramework>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(cpmPath, cpmContent);
		await Bun.write(projPath, projContent);

		// Run scanning
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyLib/MyNoVersionLib.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);
		const pkg = packages[0];
		expect(pkg).toBeDefined();
		if (pkg) {
			expect(pkg.name).toBe('MyNoVersionLib');
			// 1. Verify version is correctly resolved from Directory.Packages.props (and brackets stripped)
			expect(pkg.version).toBe('1.2.3');

			// 2. Bump the package version to 1.3.0
			await adapter.bumpOwnVersion(pkg, '1.3.0');

			// 3. Verify Directory.Packages.props is updated to [1.3.0] preserving exact-pin brackets format
			const updatedCpm = await Bun.file(cpmPath).text();
			expect(updatedCpm).toContain('<PackageVersion Include="MyNoVersionLib" Version="[1.3.0]" />');
		}
	});

	test('Successfully respects inner-to-outer property precedence (evaluation order)', async () => {
		const adapter = new MsbuildAdapter();

		const outerPropsPath = join(tempDir, 'src/Directory.Build.props');
		const innerPropsPath = join(tempDir, 'src/MyLib/Directory.Build.props');
		const projPath = join(tempDir, 'src/MyLib/MyPrecedenceLib.csproj');

		// Outer property file defines 1.0.0-outer
		const outerPropsContent = `
<Project>
  <PropertyGroup>
    <Precedence_Prop>1.0.0-outer</Precedence_Prop>
  </PropertyGroup>
</Project>
		`;

		// Inner property file overrides with 2.0.0-inner
		const innerPropsContent = `
<Project>
  <PropertyGroup>
    <Precedence_Prop>2.0.0-inner</Precedence_Prop>
  </PropertyGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(Precedence_Prop)</Version>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(outerPropsPath, outerPropsContent);
		await Bun.write(innerPropsPath, innerPropsContent);
		await Bun.write(projPath, projContent);

		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/MyLib/MyPrecedenceLib.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(1);
		const pkg = packages[0];
		expect(pkg).toBeDefined();
		if (pkg) {
			expect(pkg.name).toBe('MyPrecedenceLib');
			// Inner definition (2.0.0-inner) must win over outer definition (1.0.0-outer)!
			expect(pkg.version).toBe('2.0.0-inner');
		}
	});

	test('Successfully isolates property maps scoped per project (no global map leak)', async () => {
		const adapter = new MsbuildAdapter();

		const projAPath = join(tempDir, 'src/ProjA/ProjA.csproj');
		const propsAPath = join(tempDir, 'src/ProjA/Directory.Build.props');

		const projBPath = join(tempDir, 'src/ProjB/ProjB.csproj');
		const propsBPath = join(tempDir, 'src/ProjB/Directory.Build.props');

		const propsAContent = `
<Project>
  <PropertyGroup>
    <Scoped_Prop>7.0.0-A</Scoped_Prop>
  </PropertyGroup>
</Project>
		`;

		const projAContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(Scoped_Prop)</Version>
  </PropertyGroup>
</Project>
		`;

		const propsBContent = `
<Project>
  <PropertyGroup>
    <Scoped_Prop>8.0.0-B</Scoped_Prop>
  </PropertyGroup>
</Project>
		`;

		const projBContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>$(Scoped_Prop)</Version>
  </PropertyGroup>
</Project>
		`;

		mkdirSync(join(tempDir, 'src/ProjA'), { recursive: true });
		mkdirSync(join(tempDir, 'src/ProjB'), { recursive: true });

		await Bun.write(propsAPath, propsAContent);
		await Bun.write(projAPath, projAContent);
		await Bun.write(propsBPath, propsBContent);
		await Bun.write(projBPath, projBContent);

		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['src/ProjA/ProjA.csproj', 'src/ProjB/ProjB.csproj'], undefined, tempDir,
		)) {
			packages.push(pkg);
		}

		expect(packages).toHaveLength(2);

		const pkgA = packages.find(p => p.name === 'ProjA');
		const pkgB = packages.find(p => p.name === 'ProjB');

		expect(pkgA).toBeDefined();
		expect(pkgB).toBeDefined();

		if (pkgA && pkgB) {
			expect(pkgA.version).toBe('7.0.0-A');
			expect(pkgB.version).toBe('8.0.0-B');
		}
	});
});
