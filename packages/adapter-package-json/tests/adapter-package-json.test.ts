/* eslint import-x/extensions: 0 */
import {
	rmSync, mkdirSync,
} from 'fs';
import { join } from 'path';
import type { PackageData } from '@package-pal/core';
import {
	describe, test, expect, beforeAll, afterAll,
} from 'bun:test';
import { findAndReplaceJsonVersion } from '../src/lib/functions/find-and-replace-json-version';
import { parsePackageJson } from '../src/lib/functions/parse-package-json';
import { PackageJsonAdapter } from '../src/lib/package-json-adapter';

describe('PackageJsonAdapter Functions', () => {
	test('parses package.json correctly', () => {
		const rawJson = JSON.stringify(
			{
				name: 'my-js-package',
				version: '1.2.3',
				dependencies: { 'dep-a': '^1.0.0' },
				devDependencies: { 'dep-b': 'workspace:^' },
			}, null, 2,
		);

		const parsed = parsePackageJson('/workspace/my-js-package/package.json', rawJson);
		expect(parsed).toBeDefined();
		expect(parsed?.name).toBe('my-js-package');
		expect(parsed?.version).toBe('1.2.3');
		expect(parsed?.localDependencies).toEqual(['dep-a', 'dep-b']);
	});

	test('replaces json version surgically', () => {
		const rawJson = `{"name": "test", "version": "1.0.0"}`;
		const replaced = findAndReplaceJsonVersion({
			raw: rawJson,
			field: 'version',
			packageName: 'test',
			updatePackageName: 'test',
			newVersion: '1.1.0',
			exact: true,
		});
		expect(replaced).toContain('"version": "1.1.0"');
	});

	test('handles braces in strings and nested objects safely (correctness)', () => {
		const rawJson = `{
			"name": "complex-test",
			"version": "1.0.0 } brace in string",
			"dependencies": {
				"dep-a": "1.0.0",
				"dep-nested": {
					"inner": true,
					"brace": "}"
				},
				"dep-b": "workspace:^2.0.0"
			}
		}`;

		const replacedVersion = findAndReplaceJsonVersion({
			raw: rawJson,
			field: 'version',
			packageName: 'complex-test',
			updatePackageName: 'complex-test',
			newVersion: '1.1.0',
			exact: true,
		});
		expect(replacedVersion).toContain('"version": "1.1.0"');

		const replacedDep = findAndReplaceJsonVersion({
			raw: rawJson,
			field: 'dependencies',
			packageName: 'dep-b',
			updatePackageName: 'complex-test',
			newVersion: '2.1.0',
			exact: false,
		});
		expect(replacedDep).toContain('"dep-b": "workspace:^2.1.0"');
	});

	test('avoids false matching with comments and loose keys', () => {
		const rawJson = `{
			"name": "comment-test",
			"version": "1.0.0",
			// "dependenciesBackup": { "dep-a": "9.9.9" },
			/* "@foo/bar": "9.9.9" */
			"dependencies": {
				// "@foo/bar": "0.0.1",
				"@foo/bar": "^1.0.0",
				"@foo/bar-utils": "^2.0.0"
			}
		}`;

		const replaced = findAndReplaceJsonVersion({
			raw: rawJson,
			field: 'dependencies',
			packageName: '@foo/bar',
			updatePackageName: 'comment-test',
			newVersion: '1.2.3',
			exact: false,
		});

		expect(replaced).toContain('"@foo/bar": "^1.2.3"');
		expect(replaced).toContain('"@foo/bar-utils": "^2.0.0"');
		expect(replaced).not.toContain('"@foo/bar": "^1.2.3-utils"');
	});

	test('handles complex npm version prefixes and workspace syntax', () => {
		const versions = [
			{
				current: 'workspace:^1.2.3',
				expectedExact: '1.5.0',
				expectedNonExact: 'workspace:^1.5.0',
			},
			{
				current: 'workspace:~1.2.3',
				expectedExact: '1.5.0',
				expectedNonExact: 'workspace:~1.5.0',
			},
			{
				current: 'workspace:*',
				expectedExact: '1.5.0',
				expectedNonExact: 'workspace:^1.5.0',
			},
			{
				current: 'workspace:^',
				expectedExact: '1.5.0',
				expectedNonExact: 'workspace:^1.5.0',
			},
			{
				current: '^1.2.3',
				expectedExact: '1.5.0',
				expectedNonExact: '^1.5.0',
			},
			{
				current: '~1.2.3',
				expectedExact: '1.5.0',
				expectedNonExact: '~1.5.0',
			},
			{
				current: 'latest',
				expectedExact: '1.5.0',
				expectedNonExact: '^1.5.0',
			},
			{
				current: '*',
				expectedExact: '1.5.0',
				expectedNonExact: '^1.5.0',
			},
		];

		for (const {
			current, expectedExact, expectedNonExact,
		} of versions) {
			const json = `{"dependencies": {"dep-a": "${current}"}}`;

			const resExact = findAndReplaceJsonVersion({
				raw: json,
				field: 'dependencies',
				packageName: 'dep-a',
				updatePackageName: 'test',
				newVersion: '1.5.0',
				exact: true,
			});
			expect(resExact).toContain(`"dep-a": "${expectedExact}"`);

			const resNonExact = findAndReplaceJsonVersion({
				raw: json,
				field: 'dependencies',
				packageName: 'dep-a',
				updatePackageName: 'test',
				newVersion: '1.5.0',
				exact: false,
			});
			expect(resNonExact).toContain(`"dep-a": "${expectedNonExact}"`);
		}
	});

	test('retains alternative formatting and quote types', () => {
		const rawJson = `{
  'name': 'single-quote-test',
  'version': '1.0.0',
  'dependencies': {
    'dep-a': 'workspace:^1.0.0'
  }
}`;

		const replaced = findAndReplaceJsonVersion({
			raw: rawJson,
			field: 'dependencies',
			packageName: 'dep-a',
			updatePackageName: 'single-quote-test',
			newVersion: '1.1.0',
			exact: false,
		});

		expect(replaced).toContain('\'dep-a\': \'workspace:^1.1.0\'');
	});
});

describe('PackageJsonAdapter Integration and Robustness', () => {
	const tempJsonDir = join(import.meta.dirname, 'temp-test-json');

	beforeAll(() => {
		mkdirSync(tempJsonDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(tempJsonDir, {
			recursive: true,
			force: true,
		});
	});

	test('bumpOwnVersion updates package version in manifest', async () => {
		const adapter = new PackageJsonAdapter();
		const tempPath = join(tempJsonDir, 'temp-pkg.json');
		const initialJson = JSON.stringify(
			{
				name: 'temp-pkg',
				version: '1.0.0',
			}, null, 2,
		);

		await Bun.write(tempPath, initialJson);

		const pkgData: PackageData = {
			name: 'temp-pkg',
			path: tempPath,
			dir: tempJsonDir,
			rawContent: initialJson,
			version: '1.0.0',
			localDependencies: [],
		};

		await adapter.bumpOwnVersion(pkgData, '1.1.0');

		const updatedText = await Bun.file(tempPath).text();
		expect(updatedText).toContain('"version": "1.1.0"');
		expect(pkgData.rawContent).toContain('"version": "1.1.0"');
	});

	test('bumpDependencyVersion updates workspace dependencies across major bumps', async () => {
		const adapter = new PackageJsonAdapter();
		const tempPath = join(tempJsonDir, 'temp-dependent.json');
		const initialJson = JSON.stringify(
			{
				name: 'temp-dependent',
				version: '1.0.0',
				dependencies: { 'my-dependency': 'workspace:^1.0.0' },
			}, null, 2,
		);

		await Bun.write(tempPath, initialJson);

		const pkgData: PackageData = {
			name: 'temp-dependent',
			path: tempPath,
			dir: tempJsonDir,
			rawContent: initialJson,
			version: '1.0.0',
			dependencies: { 'my-dependency': 'workspace:^1.0.0' },
			localDependencies: ['my-dependency'],
		};

		// Major bump should not be skipped!
		const updated = await adapter.bumpDependencyVersion(
			pkgData,
			'my-dependency',
			'2.0.0',
			false, // exact = false
		);

		expect(updated).toBe(true);
		expect(pkgData.rawContent).toContain('"my-dependency": "workspace:^2.0.0"');
	});

	test('bumpDependencyVersion respects exact option and semver satisfaction', async () => {
		const adapter = new PackageJsonAdapter();
		const tempPath = join(tempJsonDir, 'temp-satisfaction.json');
		const initialJson = JSON.stringify(
			{
				name: 'temp-satisfaction',
				version: '1.0.0',
				dependencies: { 'my-dependency': '^1.0.0' },
			}, null, 2,
		);

		await Bun.write(tempPath, initialJson);

		const pkgData: PackageData = {
			name: 'temp-satisfaction',
			path: tempPath,
			dir: tempJsonDir,
			rawContent: initialJson,
			version: '1.0.0',
			dependencies: { 'my-dependency': '^1.0.0' },
			localDependencies: ['my-dependency'],
		};

		// Minor bump should be skipped if exact is false since ^1.0.0 already satisfies 1.1.0
		const skipped = await adapter.bumpDependencyVersion(
			pkgData,
			'my-dependency',
			'1.1.0',
			false, // exact = false
		);

		expect(skipped).toBe(false);
		expect(pkgData.rawContent).toContain('"my-dependency": "^1.0.0"');

		// Minor bump should NOT be skipped if exact is true
		const updated = await adapter.bumpDependencyVersion(
			pkgData,
			'my-dependency',
			'1.1.0',
			true, // exact = true
		);

		expect(updated).toBe(true);
		expect(pkgData.rawContent).toContain('"my-dependency": "1.1.0"');
	});

	test('scanPackages gracefully skips malformed json files without throwing', async () => {
		const adapter = new PackageJsonAdapter();
		const tempDir = join(tempJsonDir, 'temp-malformed-dir');
		const tempPath = join(tempDir, 'package.json');
		const malformedJson = '{ name: "invalid-json", version: "1.0.0" '; // Missing closing brace

		await Bun.write(tempPath, malformedJson);

		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages([tempDir])) {
			packages.push(pkg);
		}

		expect(packages.length).toBe(0);
	});
});
