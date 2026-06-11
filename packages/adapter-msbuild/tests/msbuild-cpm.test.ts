/* eslint import-x/extensions: 0 */
import {
	rmSync, mkdirSync,
} from 'fs';
import { join } from 'path';
import {
	describe, test, expect, beforeAll, afterAll,
} from 'bun:test';
import { analyzeCpmFile } from '../src/lib/functions/analyze-cpm-file';
import { bumpMsbuildReferenceVersion } from '../src/lib/functions/bump-msbuild-reference-version';
import { findCpmFile } from '../src/lib/functions/find-cpm-file';

describe('Central Package Management (CPM) Support', () => {
	const cpmTempDir = join(import.meta.dir, 'temp-test-cpm');

	beforeAll(() => {
		mkdirSync(cpmTempDir, { recursive: true });
		mkdirSync(join(cpmTempDir, 'src/MyProject'), { recursive: true });
	});

	afterAll(() => {
		rmSync(cpmTempDir, {
			recursive: true,
			force: true,
		});
	});

	test('analyzeCpmFile correctly detects enabled status and ownership', () => {
		const xmlEnabled = `
<Project>
  <ItemGroup>
    <PackageVersion Include="MyPackage" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;
		expect(analyzeCpmFile(xmlEnabled, 'MyPackage')).toEqual({
			enabled: true,
			hasPackage: true,
		});
		expect(analyzeCpmFile(xmlEnabled, 'UnownedPackage')).toEqual({
			enabled: true,
			hasPackage: false,
		});

		const xmlDisabled = `
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="MyPackage" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;
		expect(analyzeCpmFile(xmlDisabled, 'MyPackage')).toEqual({
			enabled: false,
			hasPackage: false,
		});
	});

	test('findCpmFile successfully walks up and finds Directory.Packages.props', async () => {
		const cpmPath = join(cpmTempDir, 'Directory.Packages.props');
		const projPath = join(cpmTempDir, 'src/MyProject/MyProject.csproj');

		await Bun.write(cpmPath, '<Project />');
		const resolvedCpm = findCpmFile(projPath);
		expect(resolvedCpm).toBeDefined();
		expect(resolvedCpm?.replace(/\\/g, '/')).toContain('temp-test-cpm/Directory.Packages.props');
	});

	test('bumpMsbuildReferenceVersion successfully bumps PackageVersion inside Directory.Packages.props', () => {
		const propsXml = `
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>
</Project>
		`;

		const bumped = bumpMsbuildReferenceVersion(
			propsXml, 'Newtonsoft.Json', '13.0.3',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.currentVersion).toBe('13.0.1');
		expect(bumped?.updatedRaw).toContain('<PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />');
	});

	test('MsbuildAdapter bumpDependencyVersion redirects updates to Directory.Packages.props when CPM is active', async () => {
		const { MsbuildAdapter } = await import('../src/lib/msbuild-adapter');
		const adapter = new MsbuildAdapter();

		const cpmPath = join(cpmTempDir, 'Directory.Packages.props');
		const projPath = join(cpmTempDir, 'src/MyProject/MyProject.csproj');

		const cpmContent = `
<Project>
  <ItemGroup>
    <PackageVersion Include="SomeSharedDep" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="SomeSharedDep" />
  </ItemGroup>
</Project>
		`;

		await Bun.write(cpmPath, cpmContent);
		await Bun.write(projPath, projContent);

		const packageData = {
			rawContent: projContent,
			name: 'MyProject',
			path: projPath,
			dir: 'MyProject',
			version: '1.0.0',
			localDependencies: ['SomeSharedDep'],
		};

		const success = await adapter.bumpDependencyVersion(
			packageData, 'SomeSharedDep', '2.0.0', true,
		);
		expect(success).toBe(true);

		// Verify CPM file is updated
		const updatedCpm = await Bun.file(cpmPath).text();
		expect(updatedCpm).toContain('<PackageVersion Include="SomeSharedDep" Version="2.0.0" />');

		// Verify Project file is untouched (still has no version attribute/child)
		const updatedProj = await Bun.file(projPath).text();
		expect(updatedProj).toBe(projContent);
	});

	test('MsbuildAdapter bumpDependencyVersion falls back to proj file when dependency is not managed centrally', async () => {
		const { MsbuildAdapter } = await import('../src/lib/msbuild-adapter');
		const adapter = new MsbuildAdapter();

		const cpmPath = join(cpmTempDir, 'Directory.Packages.props');
		const projPath = join(cpmTempDir, 'src/MyProject/MyProject.csproj');

		const cpmContent = `
<Project>
  <ItemGroup>
    <PackageVersion Include="SomeSharedDep" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="NotCentrallyManaged" Version="5.0.0" />
  </ItemGroup>
</Project>
		`;

		await Bun.write(cpmPath, cpmContent);
		await Bun.write(projPath, projContent);

		const packageData = {
			rawContent: projContent,
			name: 'MyProject',
			path: projPath,
			dir: 'MyProject',
			version: '1.0.0',
			localDependencies: ['NotCentrallyManaged'],
		};

		const success = await adapter.bumpDependencyVersion(
			packageData, 'NotCentrallyManaged', '5.1.0', true,
		);
		expect(success).toBe(true);

		// Verify CPM file is untouched
		const updatedCpm = await Bun.file(cpmPath).text();
		expect(updatedCpm).toBe(cpmContent);

		// Verify Project file is updated
		const updatedProj = await Bun.file(projPath).text();
		expect(updatedProj).toContain('<PackageReference Include="NotCentrallyManaged" Version="5.1.0" />');
	});

	test('MsbuildAdapter bumpDependencyVersion respects explicitly disabled CPM and falls back to project file', async () => {
		const { MsbuildAdapter } = await import('../src/lib/msbuild-adapter');
		const adapter = new MsbuildAdapter();

		const cpmPath = join(cpmTempDir, 'Directory.Packages.props');
		const projPath = join(cpmTempDir, 'src/MyProject/MyProject.csproj');

		const cpmContent = `
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="MyPackage" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;

		const projContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyPackage" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;

		await Bun.write(cpmPath, cpmContent);
		await Bun.write(projPath, projContent);

		const packageData = {
			rawContent: projContent,
			name: 'MyProject',
			path: projPath,
			dir: 'MyProject',
			version: '1.0.0',
			localDependencies: ['MyPackage'],
		};

		const success = await adapter.bumpDependencyVersion(
			packageData, 'MyPackage', '1.1.0', true,
		);
		expect(success).toBe(true);

		// Verify CPM file is untouched
		const updatedCpm = await Bun.file(cpmPath).text();
		expect(updatedCpm).toBe(cpmContent);

		// Verify Project file is updated
		const updatedProj = await Bun.file(projPath).text();
		expect(updatedProj).toContain('<PackageReference Include="MyPackage" Version="1.1.0" />');
	});

	test('MsbuildAdapter runLocked cleans up lock map upon completion to prevent memory leaks', async () => {
		const { MsbuildAdapter } = await import('../src/lib/msbuild-adapter');
		const adapter = new MsbuildAdapter();

		const projPath = join(cpmTempDir, 'src/MyProject/MyProject.csproj');
		await Bun.write(projPath, '<Project />');

		const packageData = {
			rawContent: '<Project />',
			name: 'MyProject',
			path: projPath,
			dir: 'MyProject',
			version: '1.0.0',
			localDependencies: [],
		};

		// Run bumpOwnVersion which uses runLocked
		const adapterAccess = adapter as unknown as { fileMutexes: Map<string, Promise<void>> };
		const mutexesMap = adapterAccess.fileMutexes;
		const bumpPromise = adapter.bumpOwnVersion(packageData, '2.0.0');

		// While running, lock is active
		expect(mutexesMap.size).toBe(1);

		await bumpPromise;

		// Once completed, lock should be cleaned up from the map
		expect(mutexesMap.size).toBe(0);
	});

	test('MsbuildAdapter runLocked serializes concurrent writes on the same file', async () => {
		const { MsbuildAdapter } = await import('../src/lib/msbuild-adapter');
		const adapter = new MsbuildAdapter();

		const projPath = join(cpmTempDir, 'concurrency.csproj');
		await Bun.write(projPath, '<Project />');

		const executionOrder: string[] = [];

		const adapterAccess = adapter as unknown as { runLocked: <T>(filePath: string, action: () => Promise<T>) => Promise<T> };

		const taskA = adapterAccess.runLocked(projPath, async () => {
			await Bun.sleep(50); // Slower task
			executionOrder.push('A');
		});

		const taskB = adapterAccess.runLocked(projPath, async () => {
			await Bun.sleep(10); // Faster task
			executionOrder.push('B');
		});

		await Promise.all([taskA, taskB]);

		// Even though B has a shorter sleep time, the lock forces it to wait for A to finish,
		// ensuring deterministic FIFO serialization order.
		expect(executionOrder).toEqual(['A', 'B']);
	});
});
