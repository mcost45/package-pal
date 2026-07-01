/* eslint import-x/extensions: 0 */
import * as originalCore from '@package-pal/core';
import { noOp } from '@package-pal/util';
import {
	afterAll, describe, expect, mock, test,
} from 'bun:test';
import * as originalGetAdapter from '../src/lib/commands/functions/get-adapter';

// Store references to the original unmocked functions before mock.module runs.
// Since these are constant references to the actual functions, they cannot be mutated or overridden
// when Bun overrides the module exports, completely preventing infinite recursion/RangeErrors.
const realReadPackagePalConfig = originalCore.readPackagePalConfig;
const realGetPackageGraphs = originalCore.getPackageGraphs;
const realReadPackageData = originalCore.readPackageData;
const realWatchPackages = originalCore.watchPackages;
const realGetAdapter = originalGetAdapter.getAdapter;

let useMock = true;

let mockConfig: originalCore.Config = { watch: { hooks: {
	onInit: noOp,
	onBeforeProcessPackage: noOp,
	onProcessPackage: noOp,
	onProcessPackageError: noOp,
	onAfterProcessPackage: noOp,
	onBeforePackagesReady: noOp,
	onPackagesReady: noOp,
	onAfterPackagesReady: noOp,
} } };

await mock.module('@package-pal/core', () => {
	return {
		...originalCore,
		readPackagePalConfig: (...args: Parameters<typeof realReadPackagePalConfig>) => {
			if (useMock) {
				return Promise.resolve({
					config: mockConfig,
					rootDir: '/dummy/root',
				} as unknown as ReturnType<typeof realReadPackagePalConfig> extends Promise<infer R> ? R : never);
			}
			return realReadPackagePalConfig(...args);
		},
		getPackageGraphs: (...args: Parameters<typeof realGetPackageGraphs>) => {
			if (useMock) {
				return {
					dependencies: new Map(),
					dependents: new Map(),
				};
			}
			return realGetPackageGraphs(...args);
		},
		readPackageData: (...args: Parameters<typeof realReadPackageData>) => {
			if (useMock) {
				return Promise.resolve([]);
			}
			return realReadPackageData(...args);
		},
		watchPackages: (...args: Parameters<typeof realWatchPackages>) => {
			if (useMock) {
				return;
			}
			realWatchPackages(...args);
		},
	};
});

await mock.module('../src/lib/commands/functions/get-adapter', () => {
	return { getAdapter: (...args: Parameters<typeof realGetAdapter>) => {
		if (useMock) {
			return Promise.resolve({} as unknown as ReturnType<typeof realGetAdapter> extends Promise<infer R> ? R : never);
		}
		return realGetAdapter(...args);
	} };
});

// Import dynamically after mocking to ensure mocks are in place
const { default: doWatch } = await import('../src/lib/commands/functions/do-watch');

describe('do-watch command', () => {
	afterAll(() => {
		useMock = false;
	});

	test('throws an error if no watch hooks are defined', async () => {
		mockConfig = { watch: { hooks: {
			onInit: noOp,
			onBeforeProcessPackage: noOp,
			onProcessPackage: noOp,
			onProcessPackageError: noOp,
			onAfterProcessPackage: noOp,
			onBeforePackagesReady: noOp,
			onPackagesReady: noOp,
			onAfterPackagesReady: noOp,
		} } };

		let error: Error | undefined;
		try {
			await doWatch({});
		} catch (err: unknown) {
			error = err as Error;
		}

		expect(error).toBeDefined();
		expect(error?.message).toBe('No watch hooks defined. The watch command has nothing to do; please configure at least one watch hook.');
	});

	test('succeeds (does not throw) if at least one watch hook is defined', async () => {
		mockConfig = { watch: { hooks: {
			onInit: () => 'echo initialized',
			onBeforeProcessPackage: noOp,
			onProcessPackage: noOp,
			onProcessPackageError: noOp,
			onAfterProcessPackage: noOp,
			onBeforePackagesReady: noOp,
			onPackagesReady: noOp,
			onAfterPackagesReady: noOp,
		} } };

		await doWatch({});
	});
});
