import { isDefined } from '@package-pal/util';
import { checkBun } from './configuration/functions/check-bun.ts';
import { loadConfig } from './configuration/functions/load-config.ts';
import type { ActivatedConfig } from './configuration/types/activated-config.ts';
import { generateGraphs } from './graph/functions/generate-graphs.ts';
import { generatePackageCircularDependencyPaths } from './graph/functions/generate-package-circular-dependency-paths.ts';
import { generateTopologicalSortedGroups } from './graph/functions/generate-topological-sorted-groups.ts';
import type { PackageGraphs } from './graph/types/package-graphs.ts';
import type { PackageOrder } from './graph/types/package-order.ts';
import { loadPackages } from './package/functions/load-packages.ts';
import { updatePackageVersion } from './package/functions/update-package-version.ts';
import type { PackageData } from './package/types/package-data.ts';
import type { BumpPackageVersionOptions } from './types/bump-package-version-options.ts';
import type { GetConfigOptions } from './types/get-config-options.ts';
import type { GetPackageCircularDependencyPathsOptions } from './types/get-package-circular-dependency-paths-options.ts';
import type { GetPackageDataOptions } from './types/get-package-data-options.ts';
import type { GetPackageGraphOptions } from './types/get-package-graph-options.ts';
import type { GetPackageOrderOptions } from './types/get-package-order-options.ts';
import type { WatchPackagesOptions } from './types/watch-packages-options.ts';
import { watchPackageChanges } from './watch/functions/watch-package-changes.ts';

/**
 * Searches upward from the current directory for a config file until one is found or the root is reached.
 * If found, the config is loaded and merged with default values.
 */
export const readPackagePalConfig = (options?: GetConfigOptions): Promise<ActivatedConfig> => {
	checkBun();
	return loadConfig(options?.overrideConfigPath);
};

/**
 * Finds and reads all `package.json` files that match the given glob patterns.
 */
export const readPackageData = async (options: GetPackageDataOptions): Promise<PackageData[]> => {
	checkBun();
	const packagePatterns = Array.isArray(options.config.packages) ? options.config.packages : [options.config.packages];
	return loadPackages(packagePatterns, options.config.logger);
};

/**
 * Computes dependency graphs for all packages.
 */
export const getPackageGraphs = (options: GetPackageGraphOptions): PackageGraphs => {
	checkBun();
	return generateGraphs(options.packageData, options.config.logger);
};

/**
 * Computes topologically sorted groups of packages.
 * Actions must be performed on each group sequentially,
 * but packages within the same group can be processed in parallel.
 */
export const getPackageOrder = (options: GetPackageOrderOptions): PackageOrder => {
	checkBun();
	return generateTopologicalSortedGroups(options.packageGraphs.dependencies, options.config.logger);
};

/**
 * Detects circular dependencies between packages and computes paths representing each cycle.
 */
export const getPackageCircularDependencyPaths = (options: GetPackageCircularDependencyPathsOptions): string[][] => {
	checkBun();
	return generatePackageCircularDependencyPaths(
		options.packageGraphs,
		options.packageOrder,
		options.config.logger,
	);
};

/**
 * Bumps the source package version and updates any dependents if the new version
 * is no longer semver-compatible, preserving original version prefixes (e.g., `^`, `~`).
 * Does not publish.
 */
export const bumpPackageVersion = (options: BumpPackageVersionOptions): Promise<void> => {
	checkBun();
	const exact = isDefined(options.exact) ? options.exact : options.config.version.exact;
	const preId = isDefined(options.preId) ? options.preId : options.config.version.preId;
	return updatePackageVersion(
		options.packageName,
		options.type,
		options.packageGraphs,
		preId,
		exact,
		options.config.logger,
	);
};

/**
 * Watches package source file changes, and triggers respective hooks defined in config.
 */
export const watchPackages = (options: WatchPackagesOptions) => {
	checkBun();
	watchPackageChanges(
		options.packageData,
		options.packageGraphs,
		options.config.watch,
		options.config.logger,
	);
};
