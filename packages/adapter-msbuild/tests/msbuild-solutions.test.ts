/* eslint import-x/extensions: 0 */
import {
	rmSync, mkdirSync,
} from 'fs';
import { join } from 'path';
import { assertDefined } from '@package-pal/util';
import {
	describe, test, expect, beforeAll, afterAll,
} from 'bun:test';

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

describe('MsbuildAdapter parseSln Robustness', () => {
	const robustTempDir = join(import.meta.dir, 'temp-test-robust-sln');

	beforeAll(async () => {
		mkdirSync(robustTempDir, { recursive: true });
		// Create mock project files of various types to test project type awareness and existence checks
		const projectTypes = [
			'csproj',
			'fsproj',
			'vbproj',
			'vcxproj',
			'sqlproj',
			'shproj',
			'customproj',
			'myproj',
			'backup-proj',
			'proj-old',
		];
		for (const type of projectTypes) {
			const projectDir = join(robustTempDir, `Project.${type}`);
			mkdirSync(projectDir, { recursive: true });
			await Bun.write(join(projectDir, `Project.${type}`), '<Project></Project>');
		}
	});

	afterAll(() => {
		rmSync(robustTempDir, {
			recursive: true,
			force: true,
		});
	});

	test('parses robust .sln files with extreme line breaks, MSBuild variables, and strict extension checks', async () => {
		const slnContent = `
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
Project("{F184B08F-C81C-45F6-A57F-5ABD9991F28F}") = 
	"FSharpProj", 
	"$(SolutionDir)\\Project.fsproj\\Project.fsproj", 
	"{B30AF747-C6A7-463F-A491-03EF1A031F1C}"
EndProject
Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "CppProj", "Project.vcxproj\\Project.vcxproj", "{C40AF747-C6A7-463F-A491-03EF1A031F1D}"
Project("{EC28E719-7AE1-4320-B77E-2C118534BE92}") =
"SqlProj",
"Project.sqlproj\\Project.sqlproj",
"{D40AF747-C6A7-463F-A491-03EF1A031F1E}"
EndProject
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "CustomProj", "Project.customproj\\Project.customproj", "{E40AF747-C6A7-463F-A491-03EF1A031F1F}"
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "InvalidProj1", "Project.myproj\\Project.myproj", "{E40AF747-C6A7-463F-A491-03EF1A031F2A}"
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "InvalidProj2", "Project.backup-proj\\Project.backup-proj", "{E40AF747-C6A7-463F-A491-03EF1A031F2B}"
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "InvalidProj3", "Project.proj-old\\Project.proj-old", "{E40AF747-C6A7-463F-A491-03EF1A031F2C}"
Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "SolutionFolder", "SolutionFolder", "{5F7764A8-5EE7-4D9D-99F5-85A21CC13E0E}"
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "NonExistentProj", "NonExistent\\NonExistent.csproj", "{F40AF747-C6A7-463F-A491-03EF1A031F1F}"
		`;

		const slnPath = join(robustTempDir, 'RobustSolution.sln');
		await Bun.write(slnPath, slnContent);

		const { parseSln } = await import('../src/lib/functions/parse-sln');
		const resolvedPaths = await parseSln([slnPath]);

		// Should resolve: fsproj (via $(SolutionDir)), vcxproj, sqlproj (with breaks)
		// Should NOT resolve: CustomProj (.customproj is not a standard MSBuild extension)
		// Should NOT resolve: InvalidProj1/2/3 (.myproj, .backup-proj, .proj-old are slightly too permissive extensions and must be filtered out)
		// Should NOT resolve: SolutionFolder (no valid ext / not matching), NonExistentProj (does not exist)
		expect(resolvedPaths).toHaveLength(3);
		const sortedPaths = resolvedPaths.map(p => p.replace(/\\/g, '/')).sort();
		expect(sortedPaths[0]).toContain('Project.fsproj/Project.fsproj');
		expect(sortedPaths[1]).toContain('Project.sqlproj/Project.sqlproj');
		expect(sortedPaths[2]).toContain('Project.vcxproj/Project.vcxproj');
	});

	test('parses robust .slnx files with schema-independent walking, MSBuild variables, casing deduplication, and nesting', async () => {
		// Prepare a duplicate file path with different casing or ./ relative redundancy to test deduplication
		// On Windows, paths are case-insensitive, so resolving casing differences or symlinks is critical
		const slnxContent = `
<Solution>
    <Folder Name="/MyFolder/">
        <Project Path="Project.csproj\\..\\Project.csproj\\Project.csproj"/>
        <ItemGroup>
            <!-- Schema-independent: different tags like ClassicProject, custom path attributes like Update -->
            <ClassicProject Update="$(SolutionDir)\\Project.vbproj\\Project.vbproj"/>
            <ProjectReference Include="Project.shproj/Project.shproj"/>
        </ItemGroup>
    </Folder>
    <!-- Duplicate paths checking canonical casing deduplication -->
    <Project Path="./Project.csproj/Project.csproj" />
    <Project Path="PROJECT.CSPROJ/Project.csproj" />
    <Project Path="NonExistent/NonExistent.csproj" />
</Solution>
		`;

		// Also write Project.csproj on disk so it exists
		const csprojDir = join(robustTempDir, 'Project.csproj');
		mkdirSync(csprojDir, { recursive: true });
		await Bun.write(join(csprojDir, 'Project.csproj'), '<Project></Project>');

		const slnxPath = join(robustTempDir, 'RobustSolution.slnx');
		await Bun.write(slnxPath, slnxContent);

		const { parseSln } = await import('../src/lib/functions/parse-sln');
		const resolvedPaths = await parseSln([slnxPath]);

		// Should resolve: csproj (deduplicated canonical path), vbproj (via Update attribute & $(SolutionDir)), shproj (via Include attribute)
		// Should NOT resolve: NonExistent (does not exist)
		expect(resolvedPaths).toHaveLength(3);
		const sortedPaths = resolvedPaths.map(p => p.replace(/\\/g, '/')).sort();
		expect(sortedPaths[0]).toContain('Project.csproj/Project.csproj');
		expect(sortedPaths[1]).toContain('Project.shproj/Project.shproj');
		expect(sortedPaths[2]).toContain('Project.vbproj/Project.vbproj');
	});
});
