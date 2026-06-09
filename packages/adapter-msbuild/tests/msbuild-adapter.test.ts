/* eslint import-x/extensions: 0 */
import {
	describe, test, expect,
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
		expect(bumped).toContain('<PackageReference Include="MyDependency" Version="1.1.0" />');
	});
});
