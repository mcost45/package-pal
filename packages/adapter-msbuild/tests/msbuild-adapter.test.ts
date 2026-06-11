/* eslint import-x/extensions: 0 */
import {
	rmSync, mkdirSync,
} from 'fs';
import { join } from 'path';
import { assertDefined } from '@package-pal/util';
import {
	describe, test, expect, beforeAll, afterAll,
} from 'bun:test';
import { parse as parseXml } from 'txml/txml';
import { analyzeCpmFile } from '../src/lib/functions/analyze-cpm-file';
import { bumpMsbuildReferenceVersion } from '../src/lib/functions/bump-msbuild-reference-version';
import { bumpMsbuildVersion } from '../src/lib/functions/bump-msbuild-version';
import { findCpmFile } from '../src/lib/functions/find-cpm-file';
import { parseMsbuild } from '../src/lib/functions/parse-msbuild';
import { resolveMsbuildName } from '../src/lib/functions/resolve-msbuild-name';

describe('MsbuildAdapter Functions', () => {
	test('resolves project name correctly', () => {
		const xmlWithPackageId = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <PackageId>MyAwesomeLib</PackageId>
  </PropertyGroup>
</Project>
		`;
		const nameFromId = resolveMsbuildName('/workspace/Lib.csproj', parseXml(xmlWithPackageId));
		expect(nameFromId).toBe('MyAwesomeLib');

		const xmlWithAssemblyName = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>MyAssemblyLib</AssemblyName>
  </PropertyGroup>
</Project>
		`;
		const nameFromAssembly = resolveMsbuildName('/workspace/Lib.csproj', parseXml(xmlWithAssemblyName));
		expect(nameFromAssembly).toBe('MyAssemblyLib');

		const xmlFallback = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
		`;
		const nameFallback = resolveMsbuildName('/workspace/Lib.csproj', parseXml(xmlFallback));
		expect(nameFallback).toBe('Lib');
	});

	test('parses ProjectReferences and resolves localDependencies correctly', () => {
		const xml = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\\OtherLib\\OtherLib.csproj" />
    <ProjectReference Include="..\\AnotherLib\\AnotherLib.csproj" />
  </ItemGroup>
</Project>
		`;

		const pathToName = new Map([['C:/workspace/OtherLib/OtherLib.csproj', 'OtherLibResolvedName'], ['C:/workspace/AnotherLib/AnotherLib.csproj', 'AnotherLibResolvedName']]);

		const dom = parseXml(xml);
		const parsed = parseMsbuild(
			'C:/workspace/MyProj/MyProj.csproj', xml, dom, pathToName,
		);

		expect(parsed).toBeDefined();
		expect(parsed?.name).toBe('MyProj');
		expect(parsed?.localDependencies).toEqual(['OtherLibResolvedName', 'AnotherLibResolvedName']);
	});

	test('parses ProjectReferences and resolves localDependencies correctly on Windows with backslash paths', () => {
		const xml = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\\OtherLib\\OtherLib.csproj" />
    <ProjectReference Include="..\\AnotherLib\\AnotherLib.csproj" />
  </ItemGroup>
</Project>
		`;

		const pathToName = new Map([['C:/workspace/OtherLib/OtherLib.csproj', 'OtherLibResolvedName'], ['C:/workspace/AnotherLib/AnotherLib.csproj', 'AnotherLibResolvedName']]);

		const dom = parseXml(xml);
		const parsed = parseMsbuild(
			'C:\\workspace\\MyProj\\MyProj.csproj', xml, dom, pathToName,
		);

		expect(parsed).toBeDefined();
		expect(parsed?.name).toBe('MyProj');
		expect(parsed?.localDependencies).toEqual(['OtherLibResolvedName', 'AnotherLibResolvedName']);
	});

	test('parses PackageReferences correctly', () => {
		const xml = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Update="SomeInternalPackage" Version="1.2.3" />
  </ItemGroup>
</Project>
		`;

		const dom = parseXml(xml);
		const parsed = parseMsbuild(
			'C:/workspace/MyProj/MyProj.csproj', xml, dom, new Map(),
		);

		expect(parsed).toBeDefined();
		expect(parsed?.localDependencies).toEqual(['Newtonsoft.Json', 'SomeInternalPackage']);
	});

	test('bumps msbuild version surgically', () => {
		const xmlWithVersion = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>1.0.0</Version>
  </PropertyGroup>
</Project>
		`;

		const bumped = bumpMsbuildVersion(xmlWithVersion, '1.1.0');
		expect(bumped).toContain('<Version>1.1.0</Version>');
	});

	test('bumps dependent PackageReference versions surgically', () => {
		const xmlWithPackageReference = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;

		const bumped = bumpMsbuildReferenceVersion(
			xmlWithPackageReference, 'MyDependency', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.currentVersion).toBe('1.0.0');
		expect(bumped?.updatedRaw).toContain('<PackageReference Include="MyDependency" Version="1.1.0" />');
	});

	test('handles multiline package references and custom attribute order', () => {
		const xmlMultiline = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference
      Version="1.0.0"
      Include="MyDependency"
    />
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlMultiline, 'MyDependency', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.currentVersion).toBe('1.0.0');
		expect(bumped?.updatedRaw).toContain('Version="1.1.0"');
	});

	test('handles package reference with version as a child element', () => {
		const xmlChild = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency">
      <Version>1.0.0</Version>
    </PackageReference>
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlChild, 'MyDependency', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.currentVersion).toBe('1.0.0');
		expect(bumped?.updatedRaw).toContain('<Version>1.1.0</Version>');
	});

	test('handles conditions on package references without breaking', () => {
		const xmlCondition = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="1.0.0" Condition="'$(Configuration)'=='Debug'" />
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlCondition, 'MyDependency', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.updatedRaw).toContain('Version="1.1.0"');
		expect(bumped?.updatedRaw).toContain('Condition="\'$(Configuration)\'==\'Debug\'"');
	});

	test('ignores MSBuild property expressions and wildcards/ranges', () => {
		const xmlProp = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="$(MyDependencyVersion)" />
    <PackageReference Include="MyDependency2" Version="1.*" />
    <PackageReference Include="MyDependency3" Version="[1.0,2.0)" />
  </ItemGroup>
</Project>
		`;
		expect(bumpMsbuildReferenceVersion(
			xmlProp, 'MyDependency', '1.1.0',
		)).toBeUndefined();
		expect(bumpMsbuildReferenceVersion(
			xmlProp, 'MyDependency2', '1.1.0',
		)).toBeUndefined();
		expect(bumpMsbuildReferenceVersion(
			xmlProp, 'MyDependency3', '1.1.0',
		)).toBeUndefined();
	});

	test('prevents regex injection with special characters in package name', () => {
		const xmlSpecial = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="My.Dependency+Special(Name)" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlSpecial, 'My.Dependency+Special(Name)', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.currentVersion).toBe('1.0.0');
		expect(bumped?.updatedRaw).toContain('Version="1.1.0"');
	});

	test('updates multiple package references with the same name', () => {
		const xmlMultiple = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="1.0.0" Condition="'$(Configuration)'=='Debug'" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="1.0.0" Condition="'$(Configuration)'=='Release'" />
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlMultiple, 'MyDependency', '1.1.0',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.updatedRaw).toContain('Condition="\'$(Configuration)\'==\'Debug\'"');
		expect(bumped?.updatedRaw).toContain('Condition="\'$(Configuration)\'==\'Release\'"');
		const occurrences = bumped?.updatedRaw.match(/Version="1\.1\.0"/g);
		expect(occurrences?.length).toBe(2);
	});

	test('handles complex property groups and conditions when bumping project version', () => {
		const xmlComplex = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup Condition="'$(Configuration)'=='Release'">
    <Version>2.0.0</Version>
  </PropertyGroup>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
		`;
		const bumped = bumpMsbuildVersion(xmlComplex, '1.1.0');
		expect(bumped).toContain('<Version>1.1.0</Version>');
	});

	test('inserts version inside first unconditional PropertyGroup if not already present', () => {
		const xmlNoVersion = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup Condition="'$(Configuration)'=='Debug'">
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
		`;
		const bumped = bumpMsbuildVersion(xmlNoVersion, '1.1.0');
		expect(bumped).toContain('<Version>1.1.0</Version>');
		expect(bumped).toContain('<PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Version>1.1.0</Version>\n  </PropertyGroup>');
	});

	test('handles VersionPrefix and VersionSuffix splitting and updating', () => {
		const xmlPrefixSuffix = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <VersionPrefix>1.0.0</VersionPrefix>
    <VersionSuffix>alpha</VersionSuffix>
  </PropertyGroup>
</Project>
		`;
		const bumpedWithSuffix = bumpMsbuildVersion(xmlPrefixSuffix, '1.1.0-beta.1');
		expect(bumpedWithSuffix).toContain('<VersionPrefix>1.1.0</VersionPrefix>');
		expect(bumpedWithSuffix).toContain('<VersionSuffix>beta.1</VersionSuffix>');

		const bumpedNoSuffix = bumpMsbuildVersion(xmlPrefixSuffix, '1.2.0');
		expect(bumpedNoSuffix).toContain('<VersionPrefix>1.2.0</VersionPrefix>');
		expect(bumpedNoSuffix).toContain('<VersionSuffix />');
	});

	test('escapes XML special characters correctly in version and attributes', () => {
		const xmlRef = `
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="MyDependency" Version="1.0.0" />
  </ItemGroup>
</Project>
		`;
		const bumped = bumpMsbuildReferenceVersion(
			xmlRef, 'MyDependency', '1.1.0-alpha<>&"\'',
		);
		expect(bumped).toBeDefined();
		expect(bumped?.updatedRaw).toContain('Version="1.1.0-alpha&lt;&gt;&amp;&quot;\'"');
	});

	test('never overwrites conditional version elements and correctly inserts unconditional version', () => {
		const xmlConditionalVersion = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version Condition="'$(Configuration)'=='Release'">1.0.0</Version>
  </PropertyGroup>
</Project>
		`;
		const bumped = bumpMsbuildVersion(xmlConditionalVersion, '1.1.0');
		expect(bumped).toContain('<Version Condition="\'$(Configuration)\'==\'Release\'">1.0.0</Version>');
		expect(bumped).toContain('<Version>1.1.0</Version>');
	});

	test('ensures version insertion is idempotent', () => {
		const xmlExistingVersion = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <Version>1.1.0</Version>
  </PropertyGroup>
</Project>
		`;
		const bumpedTwice = bumpMsbuildVersion(xmlExistingVersion, '1.1.0');
		const occurrences = bumpedTwice.match(/<Version>/g);
		expect(occurrences?.length).toBe(1);
	});
});

describe('MsbuildAdapter Integration Functions (parseSln and readProjects)', () => {
	const tempDir = join(import.meta.dir, 'temp-test-sln');

	beforeAll(async () => {
		// Setup temp solution and projects
		mkdirSync(tempDir, { recursive: true });
		mkdirSync(join(tempDir, 'src/MyLib'), { recursive: true });
		mkdirSync(join(tempDir, 'src/OtherLib'), { recursive: true });

		const slnContent = `
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "MyLib", "src\\MyLib\\MyLib.csproj", "{B30AF747-C6A7-463F-A491-03EF1A031F1C}"
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "OtherLib", "src\\OtherLib\\OtherLib.csproj", "{C40AF747-C6A7-463F-A491-03EF1A031F1D}"
Global
EndGlobal
		`;

		const slnxContent = `
<Solution>
    <Folder Name="/MyFolder/">
        <Project Path="src/MyLib/MyLib.csproj"/>
        <Project Path="src/OtherLib/OtherLib.csproj"/>
    </Folder>
</Solution>
		`;

		const myLibContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <PackageId>MyLibPackage</PackageId>
    <Version>1.2.3</Version>
  </PropertyGroup>
</Project>
		`;

		const otherLibContent = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>OtherLibAssembly</AssemblyName>
  </PropertyGroup>
</Project>
		`;

		await Bun.write(join(tempDir, 'MySolution.sln'), slnContent);
		await Bun.write(join(tempDir, 'MySolution.slnx'), slnxContent);
		await Bun.write(join(tempDir, 'src/MyLib/MyLib.csproj'), myLibContent);
		await Bun.write(join(tempDir, 'src/OtherLib/OtherLib.csproj'), otherLibContent);
	});

	afterAll(() => {
		rmSync(tempDir, {
			recursive: true,
			force: true,
		});
	});

	test('parseSln extracts relative project paths correctly and resolves them', async () => {
		const { parseSln } = await import('../src/lib/functions/parse-sln');
		const slnPaths = [join(tempDir, 'MySolution.sln')];
		const resolvedPaths = await parseSln(slnPaths);

		expect(resolvedPaths).toHaveLength(2);
		const sortedPaths = resolvedPaths.map(p => p.replace(/\\/g, '/')).sort();
		expect(sortedPaths[0]).toContain('temp-test-sln/src/MyLib/MyLib.csproj');
		expect(sortedPaths[1]).toContain('temp-test-sln/src/OtherLib/OtherLib.csproj');
	});

	test('parseSln extracts relative project paths correctly from .slnx files', async () => {
		const { parseSln } = await import('../src/lib/functions/parse-sln');
		const slnxPaths = [join(tempDir, 'MySolution.slnx')];
		const resolvedPaths = await parseSln(slnxPaths);

		expect(resolvedPaths).toHaveLength(2);
		const sortedPaths = resolvedPaths.map(p => p.replace(/\\/g, '/')).sort();
		expect(sortedPaths[0]).toContain('temp-test-sln/src/MyLib/MyLib.csproj');
		expect(sortedPaths[1]).toContain('temp-test-sln/src/OtherLib/OtherLib.csproj');
	});

	test('readProjects reads files and resolves Names and versions correctly', async () => {
		const { parseSln } = await import('../src/lib/functions/parse-sln');
		const { readProjects } = await import('../src/lib/functions/read-projects');

		const slnPaths = [join(tempDir, 'MySolution.sln')];
		const resolvedPaths = await parseSln(slnPaths);

		const pathToName = new Map<string, string>();
		const fileEntries = await readProjects(resolvedPaths, pathToName);

		expect(fileEntries).toHaveLength(2);
		expect(pathToName.get(assertDefined(resolvedPaths.find(p => p.includes('MyLib.csproj'))))).toBe('MyLibPackage');
		expect(pathToName.get(assertDefined(resolvedPaths.find(p => p.includes('OtherLib.csproj'))))).toBe('OtherLibAssembly');
	});
});

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
});
