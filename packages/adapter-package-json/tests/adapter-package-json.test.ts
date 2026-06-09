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
});
