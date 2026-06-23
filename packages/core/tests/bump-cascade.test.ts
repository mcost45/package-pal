/* eslint import-x/extensions: 0 */
import {
	describe, expect, test,
} from 'bun:test';
import { getPackageGraphs } from '../src/lib/api';
import type { Logger } from '../src/lib/configuration/types/logger';
import { bumpPackageVersion } from '../src/lib/package/functions/bump-package-version';
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

class TestAdapter extends PackageAdapter {
	readonly name = 'test-adapter';
	readonly manifestPattern = '*.json';
	readonly defaultPatterns = ['*'];

	public ownVersionBumps: {
		name: string;
		version: string;
	}[] = [];

	public dependencyVersionBumps: {
		dependentName: string;
		dependencyName: string;
		version: string;
	}[] = [];

	detect(): Promise<boolean> {
		return Promise.resolve(true);
	}

	async* scanPackages(): AsyncIterable<PackageData> {
		await Promise.resolve();
		yield* [];
	}

	async bumpOwnVersion(packageData: PackageData,
		newVersion: string): Promise<void> {
		await Promise.resolve();
		this.ownVersionBumps.push({
			name: packageData.name,
			version: newVersion,
		});
		packageData.version = newVersion;
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
	): Promise<boolean> {
		await Promise.resolve();
		this.dependencyVersionBumps.push({
			dependentName: dependentPackageData.name,
			dependencyName: targetDependencyName,
			version: newVersion,
		});
		return true;
	}
}

describe('Transitive Cascading Bumps', () => {
	test('should successfully perform a cascading bump of dependents in topological order', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/A',
			dir: 'A',
			version: '1.0.0',
			localDependencies: [],
		};

		const pkgB: PackageData = {
			rawContent: '',
			name: 'B',
			path: '/B',
			dir: 'B',
			version: '2.0.0',
			localDependencies: ['A'],
		};

		const pkgC: PackageData = {
			rawContent: '',
			name: 'C',
			path: '/C',
			dir: 'C',
			version: '3.0.0',
			localDependencies: ['B'],
		};

		const packageData = [
			pkgA,
			pkgB,
			pkgC,
		];
		const config = {
			logger,
			packages: '*',
			version: { exact: false },
		};

		const packageGraphs = getPackageGraphs({
			config: config as unknown as Parameters<typeof getPackageGraphs>[0]['config'],
			packageData,
		});

		const adapter = new TestAdapter();

		await bumpPackageVersion({
			packageName: 'A',
			type: 'minor',
			cascade: 'patch',
			exact: false,
			config: config as unknown as Parameters<typeof bumpPackageVersion>[0]['config'],
			packageGraphs,
			adapter,
		});

		expect(adapter.ownVersionBumps).toEqual([
			{
				name: 'A',
				version: '1.1.0',
			},
			{
				name: 'B',
				version: '2.0.1',
			},
			{
				name: 'C',
				version: '3.0.1',
			},
		]);

		expect(adapter.dependencyVersionBumps).toEqual([{
			dependentName: 'B',
			dependencyName: 'A',
			version: '1.1.0',
		}, {
			dependentName: 'C',
			dependencyName: 'B',
			version: '2.0.1',
		}]);
	});

	test('should cascade through circular dependents instead of skipping them', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/A',
			dir: 'A',
			version: '1.0.0',
			localDependencies: ['B'],
		};

		const pkgB: PackageData = {
			rawContent: '',
			name: 'B',
			path: '/B',
			dir: 'B',
			version: '2.0.0',
			localDependencies: ['A'],
		};

		const config = {
			logger,
			packages: '*',
			version: { exact: false },
		};

		const packageGraphs = getPackageGraphs({
			config: config as unknown as Parameters<typeof getPackageGraphs>[0]['config'],
			packageData: [pkgA, pkgB],
		});

		const adapter = new TestAdapter();

		await bumpPackageVersion({
			packageName: 'A',
			type: 'minor',
			cascade: 'patch',
			exact: false,
			config: config as unknown as Parameters<typeof bumpPackageVersion>[0]['config'],
			packageGraphs,
			adapter,
		});

		expect(adapter.ownVersionBumps.toSorted((a, b) => a.name.localeCompare(b.name))).toEqual([{
			name: 'A',
			version: '1.1.0',
		}, {
			name: 'B',
			version: '2.0.1',
		}]);

		expect(adapter.dependencyVersionBumps.toSorted((a, b) => a.dependentName.localeCompare(b.dependentName))).toEqual([{
			dependentName: 'A',
			dependencyName: 'B',
			version: '2.0.1',
		}, {
			dependentName: 'B',
			dependencyName: 'A',
			version: '1.1.0',
		}]);
	});
});
