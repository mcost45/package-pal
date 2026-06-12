/* eslint import-x/extensions: 0 */
import {
	mkdirSync, rmSync,
} from 'fs';
import { join } from 'path';
import {
	afterAll, beforeAll, describe, expect, test,
} from 'bun:test';
import type { Logger } from '../src/lib/configuration/types/logger';
import { loadPackages } from '../src/lib/package/functions/load-packages';
import { scanGlobPatternPaths } from '../src/lib/package/functions/scan-glob-pattern-paths';
import { PackageAdapter } from '../src/lib/package/types/package-adapter';
import type { PackageData } from '../src/lib/package/types/package-data';

const noop = (): void => {
	return undefined;
};

const logger: Logger = {
	debug: noop,
	info: noop,
	warn: noop,
	error: noop,
	success: noop,
	trace: noop,
} as Logger;

class FakeAdapter extends PackageAdapter {
	readonly name = 'fake';
	readonly manifestPattern = 'fake.json';
	readonly defaultPatterns = ['*'];
	private readonly packages: PackageData[];

	constructor(packages: PackageData[]) {
		super();
		this.packages = packages;
	}

	detect(): Promise<boolean> {
		return Promise.resolve(true);
	}

	async* scanPackages(): AsyncIterable<PackageData> {
		await Promise.resolve();
		for (const pkg of this.packages) {
			yield pkg;
		}
	}

	bumpOwnVersion(): Promise<void> {
		return Promise.reject(new Error('Not implemented for test'));
	}

	bumpDependencyVersion(): Promise<boolean> {
		return Promise.reject(new Error('Not implemented for test'));
	}
}

describe('scanGlobPatternPaths', () => {
	const tempDir = join(import.meta.dir, 'temp-test-scan-order');

	beforeAll(() => {
		mkdirSync(join(tempDir, 'b'), { recursive: true });
		mkdirSync(join(tempDir, 'a'), { recursive: true });
		mkdirSync(join(tempDir, 'c'), { recursive: true });
	});

	afterAll(() => {
		rmSync(tempDir, {
			recursive: true,
			force: true,
		});
	});

	test('returns unique paths in deterministic sorted order across overlapping patterns', async () => {
		const paths: string[] = [];
		for await (const path of scanGlobPatternPaths(['*', '{a,b}'], {
			cwd: tempDir,
			absolute: false,
			onlyFiles: false,
		})) {
			paths.push(path);
		}

		expect(paths).toEqual([
			'a',
			'b',
			'c',
		]);
	});
});

describe('loadPackages', () => {
	test('sorts loaded packages deterministically by name', async () => {
		const packages = await loadPackages(
			'/workspace',
			['packages/*'],
			new FakeAdapter([{
				name: 'zeta',
				path: '/workspace/packages/zeta/package.json',
				dir: 'zeta',
				rawContent: '{}',
			}, {
				name: 'alpha',
				path: '/workspace/packages/alpha/package.json',
				dir: 'alpha',
				rawContent: '{}',
			}]),
			logger,
		);

		expect(packages.map(pkg => pkg.name)).toEqual(['alpha', 'zeta']);
	});

	test('throws on duplicate package names from different manifests', () => {
		expect(loadPackages(
			'/workspace',
			['packages/*'],
			new FakeAdapter([{
				name: 'shared',
				path: '/workspace/packages/one/package.json',
				dir: 'one',
				rawContent: '{}',
			}, {
				name: 'shared',
				path: '/workspace/packages/two/package.json',
				dir: 'two',
				rawContent: '{}',
			}]),
			logger,
		)).rejects.toThrow(`Duplicate package name 'shared' found in multiple manifests: '/workspace/packages/one/package.json' and '/workspace/packages/two/package.json'.`);
	});

	test('dedupes identical manifests returned multiple times', async () => {
		const packages = await loadPackages(
			'/workspace',
			['packages/*'],
			new FakeAdapter([{
				name: 'shared',
				path: '/workspace/packages/shared/package.json',
				dir: 'shared',
				rawContent: '{}',
			}, {
				name: 'shared',
				path: '/workspace/packages/shared/package.json',
				dir: 'shared',
				rawContent: '{}',
			}]),
			logger,
		);

		expect(packages).toHaveLength(1);
		expect(packages[0]?.name).toBe('shared');
	});
});
