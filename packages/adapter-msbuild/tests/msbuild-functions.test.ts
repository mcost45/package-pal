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
