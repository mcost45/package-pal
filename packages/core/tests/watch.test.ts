/* eslint import-x/extensions: 0 */
import { join } from 'path';
import { normalisePath } from '@package-pal/util';
import {
	expect, test, describe,
} from 'bun:test';
import type { PackageGraphs } from '../src/lib/graph/types/package-graphs';
import { getChangeLogic } from '../src/lib/watch/functions/get-change-logic';
import { normaliseWatchedFilePath } from '../src/lib/watch/functions/normalise-watched-file-path';
import type { PackageChanges } from '../src/lib/watch/types/package-changes';

describe('normalisePath', () => {
	test('converts Windows backslashes to forward slashes', () => {
		expect(normalisePath('path\\to\\file')).toBe('path/to/file');
	});

	test('preserves already normalized paths', () => {
		expect(normalisePath('path/to/file')).toBe('path/to/file');
	});
});

describe('normaliseWatchedFilePath', () => {
	test('strips generic temporary and backup suffixes', () => {
		expect(normaliseWatchedFilePath('file.ts.tmp')).toBe('file.ts');
		expect(normaliseWatchedFilePath('file.ts.temp')).toBe('file.ts');
		expect(normaliseWatchedFilePath('file.ts.bak')).toBe('file.ts');
		expect(normaliseWatchedFilePath('file.ts.backup')).toBe('file.ts');
		expect(normaliseWatchedFilePath('file.ts~')).toBe('file.ts');
	});

	test('normalises Vim swap files and restores prepended dot correctly', () => {
		expect(normaliseWatchedFilePath('.index.ts.swp')).toBe('index.ts');
		expect(normaliseWatchedFilePath('.index.ts.swo')).toBe('index.ts');
		expect(normaliseWatchedFilePath('.index.ts.swn')).toBe('index.ts');
	});

	test('restores hidden file swap file to original dot prefix', () => {
		expect(normaliseWatchedFilePath('..env.swp')).toBe('.env');
	});

	test('leaves normal files unaffected', () => {
		expect(normaliseWatchedFilePath('index.ts')).toBe('index.ts');
		expect(normaliseWatchedFilePath(join('some-dir', 'index.ts'))).toBe(join('some-dir', 'index.ts'));
	});
});

describe('getChangeLogic', () => {
	test('groups circular dependencies into correct nested array structures', () => {
		const packageGraphs: PackageGraphs = {
			dependencies: new Map([['A', {
				packageData: {
					name: 'A',
					path: '/workspace/p-a/package.json',
					dir: 'p-a',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}], ['B', {
				packageData: {
					name: 'B',
					path: '/workspace/p-b/package.json',
					dir: 'p-b',
					rawContent: '',
				},
				pointsToPackages: new Set(['A']),
			}]]),
			dependents: new Map([['A', {
				packageData: {
					name: 'A',
					path: '/workspace/p-a/package.json',
					dir: 'p-a',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}], ['B', {
				packageData: {
					name: 'B',
					path: '/workspace/p-b/package.json',
					dir: 'p-b',
					rawContent: '',
				},
				pointsToPackages: new Set(['A']),
			}]]),
		};

		const packageChanges: PackageChanges = new Map([['A', ['/workspace/p-a/index.ts']]]);

		const config = { subprocess: { partialProcessing: true } } as unknown as Parameters<typeof getChangeLogic>[3];

		const result = getChangeLogic(
			packageGraphs, packageChanges, undefined, config,
		);

		expect(result.action).toBe('Partial');
		expect(result.changedPackageProcessOrder.every(group => Array.isArray(group))).toBe(true);
	});

	test('returns Ignore when packageChanges is empty', () => {
		const packageGraphs: PackageGraphs = {
			dependencies: new Map(),
			dependents: new Map(),
		};
		const config = { subprocess: { partialProcessing: true } } as unknown as Parameters<typeof getChangeLogic>[3];

		const result = getChangeLogic(
			packageGraphs, new Map(), undefined, config,
		);
		expect(result.action).toBe('Ignore');
	});

	test('returns Restart when partialProcessing is disabled', () => {
		const packageGraphs: PackageGraphs = {
			dependencies: new Map(),
			dependents: new Map(),
		};
		const packageChanges: PackageChanges = new Map([['A', ['/workspace/p-a/index.ts']]]);
		const config = { subprocess: { partialProcessing: false } } as unknown as Parameters<typeof getChangeLogic>[3];

		const result = getChangeLogic(
			packageGraphs, packageChanges, undefined, config,
		);
		expect(result.action).toBe('Restart');
	});
});
