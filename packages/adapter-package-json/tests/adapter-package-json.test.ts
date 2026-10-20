/* eslint import-x/extensions: 0 */
import {
	mkdtempSync, rmSync,
} from 'fs';
import {
	join, resolve, sep,
} from 'path';
import type { PackageData } from '@package-pal/core';
import {
	afterEach, beforeEach, describe, expect, test,
} from 'bun:test';
import { PackageJsonAdapter } from '../src/index';

describe('PackageJsonAdapter', () => {
	let root: string;
	let adapter: PackageJsonAdapter;

	beforeEach(() => {
		root = mkdtempSync(join(import.meta.dirname, 'temp-json-'));
		adapter = new PackageJsonAdapter();
	});

	afterEach(() => {
		if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unsafe temporary path');
		rmSync(root, {
			recursive: true,
			force: true,
		});
	});

	const scan = async () => {
		const packages: PackageData[] = [];
		for await (const pkg of adapter.scanPackages(
			['*'], undefined, root,
		)) packages.push(pkg);
		return packages;
	};

	const createPackage = async (raw: string): Promise<PackageData> => {
		await Bun.write(join(
			root, 'pkg', 'package.json',
		), raw);
		const packages = await scan();
		const pkg = packages[0];
		if (packages.length !== 1 || !pkg) throw new Error('Expected one scanned package');
		return pkg;
	};

	test('scans JSONC manifests through the package adapter', async () => {
		const pkg = await createPackage('{\n// Package metadata\n"name":"jsonc-package",\n"version":"1.2.3",\n"dependencies":{"dep-a":"^1.0.0",},\n"devDependencies":{"dep-b":"workspace:^",},\n}');
		expect(pkg).toMatchObject({
			name: 'jsonc-package',
			version: '1.2.3',
			localDependencies: ['dep-a', 'dep-b'],
		});
	});

	test('writes the own version as JSON while retaining metadata and file style', async () => {
		const raw = '{\r\n\t// Package metadata\r\n\t"name": "app",\r\n\t"description": "It\'s a package { }",\r\n\t"metadata": { "version": "9.9.9", "nested": [true, "brace }", { "quote": "\\"" }] },\r\n\t"version": "1.0.0",\r\n}\r\n';
		const pkg = await createPackage(raw);
		await adapter.bumpOwnVersion(pkg, '1.1.0');
		const updated = await Bun.file(pkg.path).text();
		expect(JSON.parse(updated)).toEqual({
			name: 'app',
			description: 'It\'s a package { }',
			metadata: {
				version: '9.9.9',
				nested: [
					true,
					'brace }',
					{ quote: '"' },
				],
			},
			version: '1.1.0',
		});
		expect(updated).toContain('\r\n\t"version": "1.1.0"\r\n');
		expect(updated.endsWith('\r\n')).toBe(true);
	});

	test.each([
		['workspace:^1.2.3', 'workspace:^2.5.0'],
		['workspace:~1.2.3', 'workspace:~2.5.0'],
		['workspace:*', 'workspace:^2.5.0'],
		['workspace:^', 'workspace:^2.5.0'],
		['workspace:~', 'workspace:~2.5.0'],
		['^1.2.3', '^2.5.0'],
		['~1.2.3', '~2.5.0'],
		['1.2.3', '2.5.0'],
		['1.2.3-beta.1+build', '2.5.0'],
		['<1.2.3', '^2.5.0'],
		['>=1.2.3 <2.0.0', '^2.5.0'],
		['workspace:>=1.2.3 <2.0.0', 'workspace:^2.5.0'],
		['latest', '^2.5.0'],
		['*', '^2.5.0'],
	])('updates %s across dependency sections, then supports exact pinning', async (current, expected) => {
		const pkg = await createPackage(JSON.stringify({
			name: 'app',
			dependencies: {
				'@foo/bar': current,
				'@foo/bar-utils': '^9.0.0',
			},
			devDependencies: { '@foo/bar': current },
			peerDependencies: { '@foo/bar': current },
			optionalDependencies: { '@foo/bar': current },
			metadata: { dependencies: { '@foo/bar': 'backup' } },
		}));
		expect(await adapter.bumpDependencyVersion(
			pkg, '@foo/bar', '2.5.0', false,
		)).toBe(true);
		expect(await Bun.file(pkg.path).json()).toEqual({
			name: 'app',
			dependencies: {
				'@foo/bar': expected,
				'@foo/bar-utils': '^9.0.0',
			},
			devDependencies: { '@foo/bar': expected },
			peerDependencies: { '@foo/bar': expected },
			optionalDependencies: { '@foo/bar': expected },
			metadata: { dependencies: { '@foo/bar': 'backup' } },
		});
		expect(await adapter.bumpDependencyVersion(
			pkg, '@foo/bar', '2.6.0', true,
		)).toBe(true);
		expect(await Bun.file(pkg.path).json()).toMatchObject({
			dependencies: { '@foo/bar': '2.6.0' },
			devDependencies: { '@foo/bar': '2.6.0' },
			peerDependencies: { '@foo/bar': '2.6.0' },
			optionalDependencies: { '@foo/bar': '2.6.0' },
		});
	});

	test('keeps satisfied or absent dependencies byte-for-byte unchanged', async () => {
		const raw = '{\n// "dependencies": { "dep": "backup" }\n"name":"app", "dependencies":{"dep":"^1.0.0"},\n}';
		const pkg = await createPackage(raw);
		expect(await adapter.bumpDependencyVersion(
			pkg, 'dep', '1.1.0', false,
		)).toBe(false);
		expect(await adapter.bumpDependencyVersion(
			pkg, 'missing', '2.0.0', true,
		)).toBe(false);
		expect(await Bun.file(pkg.path).text()).toBe(raw);
		expect(await adapter.bumpDependencyVersion(
			pkg, 'dep', '1.1.0', true,
		)).toBe(true);
		expect(await Bun.file(pkg.path).json()).toEqual({
			name: 'app',
			dependencies: { dep: '1.1.0' },
		});
		const updated = await Bun.file(pkg.path).text();
		expect(await adapter.bumpDependencyVersion(
			pkg, 'dep', '1.1.0', true,
		)).toBe(false);
		expect(await Bun.file(pkg.path).text()).toBe(updated);
	});

	test('updates dependencies named constructor without treating inherited properties as declarations', async () => {
		const pkg = await createPackage('{"name":"app","dependencies":{},"devDependencies":{"constructor":"^1.0.0"}}');
		expect(await adapter.bumpDependencyVersion(
			pkg, 'constructor', '2.0.0', false,
		)).toBe(true);
		expect(await Bun.file(pkg.path).json()).toEqual({
			name: 'app',
			dependencies: {},
			devDependencies: { constructor: '^2.0.0' },
		});
	});

	test('preserves current manifest data across concurrent version edits', async () => {
		const pkg = await createPackage('{"name":"app","version":"1.0.0","dependencies":{"dep-a":"^1.0.0","dep-b":"~1.0.0"}}');
		await Bun.write(pkg.path, '{"name":"app","description":"Edited after scanning","version":"1.0.0","dependencies":{"dep-a":"^1.0.0","dep-b":"~1.0.0"}}');
		await Promise.all([
			adapter.bumpOwnVersion(pkg, '1.1.0'),
			adapter.bumpDependencyVersion(
				pkg, 'dep-a', '2.0.0', false,
			),
			adapter.bumpDependencyVersion(
				pkg, 'dep-b', '3.0.0', true,
			),
		]);
		const updated = await Bun.file(pkg.path).text();
		expect(JSON.parse(updated)).toEqual({
			name: 'app',
			description: 'Edited after scanning',
			version: '1.1.0',
			dependencies: {
				'dep-a': '^2.0.0',
				'dep-b': '3.0.0',
			},
		});
		expect(pkg).toMatchObject({
			version: '1.1.0',
			dependencies: {
				'dep-a': '^2.0.0',
				'dep-b': '3.0.0',
			},
			rawContent: updated,
		});
		expect(await adapter.bumpDependencyVersion(
			pkg, 'dep-a', '2.1.0', false,
		)).toBe(false);
		expect(await Bun.file(pkg.path).text()).toBe(updated);
	});

	test('skips malformed manifests while continuing to scan valid packages', async () => {
		await createPackage('{"name":"valid"}');
		const invalid = [
			'{"name":',
			'null',
			'[]',
			'{"name":false}',
			'{"version":1}',
			'{"dependencies":null}',
			'{"devDependencies":[]}',
			'{"peerDependencies":{"dep":123}}',
			'{"optionalDependencies":"dep"}',
		];
		for (const [index, raw] of invalid.entries()) {
			await Bun.write(join(
				root, `invalid-${String(index)}`, 'package.json',
			), raw);
		}
		expect((await scan()).map(pkg => pkg.name)).toEqual(['valid']);
	});
});
