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
import { bumpMsbuildReferenceVersion } from '../src/lib/functions/bump-msbuild-reference-version';
import { bumpMsbuildVersion } from '../src/lib/functions/bump-msbuild-version';
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
