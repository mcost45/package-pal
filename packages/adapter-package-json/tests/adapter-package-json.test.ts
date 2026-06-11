/* eslint import-x/extensions: 0 */
import {
	describe, test, expect,
} from 'bun:test';
import { findAndReplaceJsonVersion } from '../src/lib/functions/find-and-replace-json-version';
import { parsePackageJson } from '../src/lib/functions/parse-package-json';

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
