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

const bump = {
	ignore: '',
	hooks: {
		onBeforeProcessPackage: noop,
		onProcessPackage: noop,
		onAfterProcessPackage: noop,
		onBeforePackagesReady: noop,
		onPackagesReady: noop,
		onAfterPackagesReady: noop,
	},
	subprocess: { concurrency: null },
};

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

	public events: string[] = [];

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
		this.events.push(`bump:${packageData.name}`);
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
		this.events.push(`dependency:${dependentPackageData.name}:${targetDependencyName}`);
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
			bump,
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
			bump,
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

	test('should call bump hooks for each bumped package with version context', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/A/package.json',
			dir: 'A',
			version: '1.0.0',
			localDependencies: [],
		};

		const pkgB: PackageData = {
			rawContent: '',
			name: 'B',
			path: '/B/package.json',
			dir: 'B',
			version: '2.0.0',
			localDependencies: ['A'],
		};

		const packageData = [pkgA, pkgB];
		const bumpedPackages: {
			name: string;
			previousVersion: string;
			version: string;
			type: string;
			totalBumpOrder: string[][];
		}[] = [];
		const readyOrders: string[][][] = [];
		const config = {
			logger,
			packages: '*',
			version: { exact: false },
			bump: {
				ignore: '',
				hooks: {
					onBeforeProcessPackage: noop,
					onProcessPackage: (props: Parameters<Parameters<typeof bumpPackageVersion>[0]['config']['bump']['hooks']['onProcessPackage']>[0]) => {
						bumpedPackages.push({
							name: props.name,
							previousVersion: props.previousVersion,
							version: props.version,
							type: props.type,
							totalBumpOrder: props.totalBumpOrder,
						});
					},
					onAfterProcessPackage: noop,
					onBeforePackagesReady: noop,
					onPackagesReady: (props: Parameters<Parameters<typeof bumpPackageVersion>[0]['config']['bump']['hooks']['onPackagesReady']>[0]) => {
						readyOrders.push(props.totalBumpOrder);
					},
					onAfterPackagesReady: noop,
				},
				subprocess: { concurrency: null },
			},
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

		expect(bumpedPackages).toEqual([{
			name: 'A',
			previousVersion: '1.0.0',
			version: '1.1.0',
			type: 'minor',
			totalBumpOrder: [['A'], ['B']],
		}, {
			name: 'B',
			previousVersion: '2.0.0',
			version: '2.0.1',
			type: 'patch',
			totalBumpOrder: [['A'], ['B']],
		}]);
		expect(readyOrders).toEqual([[['A'], ['B']]]);
	});

	test('should run package hooks after each bump group before the next group is bumped', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/A/package.json',
			dir: 'A',
			version: '1.0.0',
			localDependencies: [],
		};

		const pkgB: PackageData = {
			rawContent: '',
			name: 'B',
			path: '/B/package.json',
			dir: 'B',
			version: '2.0.0',
			localDependencies: ['A'],
		};

		const adapter = new TestAdapter();
		const config = {
			logger,
			packages: '*',
			version: { exact: false },
			bump: {
				ignore: '',
				hooks: {
					onBeforeProcessPackage: noop,
					onProcessPackage: (props: Parameters<Parameters<typeof bumpPackageVersion>[0]['config']['bump']['hooks']['onProcessPackage']>[0]) => {
						adapter.events.push(`hook:${props.name}`);
					},
					onAfterProcessPackage: noop,
					onBeforePackagesReady: noop,
					onPackagesReady: () => {
						adapter.events.push('ready');
					},
					onAfterPackagesReady: noop,
				},
				subprocess: { concurrency: null },
			},
		};

		const packageGraphs = getPackageGraphs({
			config: config as unknown as Parameters<typeof getPackageGraphs>[0]['config'],
			packageData: [pkgA, pkgB],
		});

		await bumpPackageVersion({
			packageName: 'A',
			type: 'minor',
			cascade: 'patch',
			exact: false,
			config: config as unknown as Parameters<typeof bumpPackageVersion>[0]['config'],
			packageGraphs,
			adapter,
		});

		expect(adapter.events).toEqual([
			'bump:A',
			'hook:A',
			'dependency:B:A',
			'bump:B',
			'hook:B',
			'ready',
		]);
	});

	test('should treat ignored packages as cascade barriers', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/repo/packages/A/package.json',
			dir: '/repo/packages/A',
			version: '1.0.0',
			localDependencies: [],
		};

		const pkgB: PackageData = {
			rawContent: '',
			name: 'B',
			path: '/repo/packages/B/package.json',
			dir: '/repo/packages/B',
			version: '2.0.0',
			localDependencies: ['A'],
		};

		const pkgC: PackageData = {
			rawContent: '',
			name: 'C',
			path: '/repo/packages/C/package.json',
			dir: '/repo/packages/C',
			version: '3.0.0',
			localDependencies: ['B'],
		};

		const processedPackages: string[] = [];
		const config = {
			logger,
			packages: '*',
			version: { exact: false },
			bump: {
				ignore: '**/B/package.json',
				hooks: {
					onBeforeProcessPackage: noop,
					onProcessPackage: (props: Parameters<Parameters<typeof bumpPackageVersion>[0]['config']['bump']['hooks']['onProcessPackage']>[0]) => {
						processedPackages.push(props.name);
					},
					onAfterProcessPackage: noop,
					onBeforePackagesReady: noop,
					onPackagesReady: noop,
					onAfterPackagesReady: noop,
				},
				subprocess: { concurrency: null },
			},
		};

		const packageGraphs = getPackageGraphs({
			config: config as unknown as Parameters<typeof getPackageGraphs>[0]['config'],
			packageData: [
				pkgA,
				pkgB,
				pkgC,
			],
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

		expect(adapter.ownVersionBumps).toEqual([{
			name: 'A',
			version: '1.1.0',
		}]);
		expect(adapter.dependencyVersionBumps).toEqual([]);
		expect(processedPackages).toEqual(['A']);
	});

	test('should reject directly bumping ignored packages', async () => {
		const pkgA: PackageData = {
			rawContent: '',
			name: 'A',
			path: '/repo/packages/A/package.json',
			dir: '/repo/packages/A',
			version: '1.0.0',
			localDependencies: [],
		};

		const config = {
			logger,
			packages: '*',
			version: { exact: false },
			bump: {
				...bump,
				ignore: '**/A/package.json',
			},
		};

		const packageGraphs = getPackageGraphs({
			config: config as unknown as Parameters<typeof getPackageGraphs>[0]['config'],
			packageData: [pkgA],
		});
		const adapter = new TestAdapter();

		let error: unknown;
		try {
			await bumpPackageVersion({
				packageName: 'A',
				type: 'minor',
				cascade: 'patch',
				exact: false,
				config: config as unknown as Parameters<typeof bumpPackageVersion>[0]['config'],
				packageGraphs,
				adapter,
			});
		} catch (err) {
			error = err;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Package \'A\' matches bump.ignore and cannot be bumped.');
	});
});
