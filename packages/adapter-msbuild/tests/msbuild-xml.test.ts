import {
	mkdtempSync, rmSync,
} from 'fs';
import {
	join, resolve, sep,
} from 'path';
import { assertDefined } from '@package-pal/util';
import { XML } from 'bun';
import {
	expect, test,
} from 'bun:test';
import { MsbuildAdapter } from '@package-pal/adapter-msbuild';

test.each([
	'project',
	'dependency',
	'property',
])('Bumping a %s version preserves XML document content and decoded values', async (target) => {
	const root = mkdtempSync(join(import.meta.dirname, 'temp-xml-'));
	if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
	const path = join(root, 'Library.csproj');
	const prefix = '<?xml version="1.0" encoding="utf-8"?>\r\n<!-- <Project> in a comment -->\r\n<!DOCTYPE Project [<!-- ] > --> <!ENTITY vendor "A &amp; B">]>\r\n';
	const suffix = '\r\n<!-- </Project> in a comment -->\r\n<?finished yes?>\r\n';
	await Bun.write(path, prefix + `<Project Sdk="Microsoft.NET.Sdk" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <Version>1.0.0</Version>
    <DependencyVersion>2.0.0</DependencyVersion>
    <Description>&vendor; &#x1F680;<![CDATA[ <raw>]]><!-- split --> tail</Description>
  </PropertyGroup>
  <?build keep?>
  <ItemGroup><PackageReference Include="External.Lib" Version="${target === 'property' ? '$(DependencyVersion)' : '2.0.0'}" /></ItemGroup>
  <Target Name="Build"><Message Text="A &amp; B &quot;quoted&quot;" /></Target>
  </Project>` + suffix);
	try {
		const adapter = new MsbuildAdapter();
		const pkg = assertDefined((await Array.fromAsync(adapter.scanPackages(
			['*.csproj'], undefined, root,
		)))[0]);
		if (target === 'project') await adapter.bumpOwnVersion(pkg, '1.0.1');
		else await adapter.bumpDependencyVersion(
			pkg, 'External.Lib', '3.0.0', true,
		);
		const updated = await Bun.file(path).text();
		expect(updated.startsWith(prefix)).toBe(true);
		expect(updated.endsWith(suffix)).toBe(true);
		expect(XML.parse(updated)).toMatchObject({ Project: {
			'@xmlns': 'http://schemas.microsoft.com/developer/msbuild/2003',
			'PropertyGroup': {
				Version: target === 'project' ? '1.0.1' : '1.0.0',
				DependencyVersion: target === 'property' ? '3.0.0' : '2.0.0',
				Description: 'A & B 🚀 <raw> tail',
			},
			'ItemGroup': { PackageReference: {
				'@Include': 'External.Lib',
				'@Version': target === 'property' ? '$(DependencyVersion)' : target === 'dependency' ? '3.0.0' : '2.0.0',
			} },
			'Target': { Message: { '@Text': 'A & B "quoted"' } },
		} });
		expect(updated).toContain('<!-- split -->');
		expect(updated).toContain('<?build keep?>');
	} finally {
		rmSync(root, {
			recursive: true,
			force: true,
		});
	}
});

test.each([
	'utf-16le',
	'utf-16be',
	'iso-8859-1',
])('Reads and bumps an %s project without corrupting text', async (encoding) => {
	const root = mkdtempSync(join(import.meta.dirname, 'temp-xml-'));
	if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
	const path = join(root, 'Library.csproj');
	const raw = `<?xml version="1.0" encoding="${encoding}"?><Project><PropertyGroup><Version>1.0.0</Version><Description>café</Description></PropertyGroup></Project>`;
	const bytes = Buffer.from(raw, encoding === 'iso-8859-1' ? 'latin1' : 'utf16le');
	await Bun.write(path, encoding === 'utf-16be' ? bytes.swap16() : bytes);
	try {
		const adapter = new MsbuildAdapter();
		const pkg = assertDefined((await Array.fromAsync(adapter.scanPackages(
			['*.csproj'], undefined, root,
		)))[0]);
		expect(pkg.version).toBe('1.0.0');
		await adapter.bumpOwnVersion(pkg, '1.0.1');
		expect(XML.parse(await Bun.file(path).bytes())).toMatchObject({ Project: { PropertyGroup: {
			Version: '1.0.1',
			Description: 'café',
		} } });
	} finally {
		rmSync(root, {
			recursive: true,
			force: true,
		});
	}
});

test.each(['<Project Unquoted=true><PropertyGroup><Version>1.0.0</Version></PropertyGroup></Project>', '<NotAProject/>'])('Rejects an invalid project without overwriting it: %s', async (malformed) => {
	const root = mkdtempSync(join(import.meta.dirname, 'temp-xml-'));
	if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
	const path = join(root, 'Library.csproj');
	await Bun.write(path, '<Project><PropertyGroup><Version>1.0.0</Version></PropertyGroup></Project>');
	try {
		const adapter = new MsbuildAdapter();
		const pkg = assertDefined((await Array.fromAsync(adapter.scanPackages(
			['*.csproj'], undefined, root,
		)))[0]);
		await Bun.write(path, malformed);
		const error = await adapter.bumpOwnVersion(pkg, '1.0.1').catch((error: unknown) => error);
		expect(error).toBeInstanceOf(SyntaxError);
		expect(await Bun.file(path).text()).toBe(malformed);
	} finally {
		rmSync(root, {
			recursive: true,
			force: true,
		});
	}
});
