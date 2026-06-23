import { styleText } from 'util';
import {
	isDefined, runAsync,
} from '@package-pal/util';
import { inc } from 'semver';
import { dfsTraverseGraph } from '../../graph/functions/dfs-traverse-graph.ts';
import { generateTopologicalSortedGroups } from '../../graph/functions/generate-topological-sorted-groups.ts';
import type { BumpPackageVersionOptions } from '../../types/bump-package-version-options.ts';

const dependentWriteConcurrency = 20;

export const bumpPackageVersion = async (options: BumpPackageVersionOptions): Promise<void> => {
	const exact = isDefined(options.exact) ? options.exact : options.config.version.exact;
	const preId = isDefined(options.preId) ? options.preId : options.config.version.preId;
	const {
		packageName, type, cascade, packageGraphs, adapter, config: { logger },
	} = options;

	logger.debug(styleText('dim', `Bumping package '${packageName}'...`));
	const packageNode = packageGraphs.dependencies.get(packageName);
	if (!packageNode) {
		throw new Error(`Package '${packageName}' not found.`);
	}

	const dependentsToBump = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName))
		.filter(pkg => pkg.name !== packageName);

	if (cascade) {
		const sortedGroupsObj = generateTopologicalSortedGroups(packageGraphs.dependencies, logger);
		const packageNamesToBump = new Set([packageName, ...dependentsToBump.map(pkg => pkg.name)]);
		const packagesToProcessInOrder = sortedGroupsObj.groups
			.map(group => group.filter(name => packageNamesToBump.has(name)))
			.filter(group => group.length > 0);
		const circularPackagesToProcess = sortedGroupsObj.circular
			.filter(name => packageNamesToBump.has(name));
		if (circularPackagesToProcess.length > 0) {
			packagesToProcessInOrder.push(circularPackagesToProcess);
		}

		const bumpedVersionsMap = new Map<string, string>();

		for (const packageGroup of packagesToProcessInOrder) {
			const groupBumpedVersionsMap = new Map<string, string>();

			for (const currentPackageName of packageGroup) {
				const node = packageGraphs.dependencies.get(currentPackageName);
				if (!node) {
					continue;
				}

				const currentVersion = node.packageData.version ?? '1.0.0';
				const bumpType = currentPackageName === packageName ? type : cascade;
				const nextVersion = inc(
					currentVersion, bumpType, undefined, preId,
				);

				if (!nextVersion) {
					throw new Error(`Package '${currentPackageName}' version '${currentVersion}' is invalid.`);
				}

				groupBumpedVersionsMap.set(currentPackageName, nextVersion);
			}

			for (const [currentPackageName, nextVersion] of groupBumpedVersionsMap) {
				bumpedVersionsMap.set(currentPackageName, nextVersion);
			}

			await runAsync(packageGroup.map(currentPackageName => async () => {
				const node = packageGraphs.dependencies.get(currentPackageName);
				if (!node) {
					return;
				}
				const nextVersion = groupBumpedVersionsMap.get(currentPackageName);
				if (!nextVersion) {
					return;
				}

				for (const depName of node.packageData.localDependencies ?? []) {
					const newlyBumpedVersion = bumpedVersionsMap.get(depName);
					if (newlyBumpedVersion) {
						await adapter.bumpDependencyVersion(
							node.packageData, depName, newlyBumpedVersion, exact, logger,
						);
					}
				}

				const currentVersion = node.packageData.version ?? '1.0.0';
				const bumpType = currentPackageName === packageName ? type : cascade;

				logger.debug(styleText('dim', `Bumping '${currentPackageName}' (${bumpType}): ${currentVersion} → ${nextVersion}`));
				await adapter.bumpOwnVersion(
					node.packageData, nextVersion, logger,
				);

				(node.packageData as { version?: string }).version = nextVersion;
			}), dependentWriteConcurrency);
		}
	} else {
		const currentVersion = packageNode.packageData.version ?? '1.0.0';
		const bumpedVersion = inc(
			currentVersion, type, undefined, preId,
		);
		if (!bumpedVersion) {
			throw new Error(`Package '${packageName}' version '${currentVersion}' is invalid.`);
		}

		logger.debug(styleText('dim', `Bumping '${packageName}' (${type}): ${currentVersion} → ${bumpedVersion}`));
		await adapter.bumpOwnVersion(
			packageNode.packageData, bumpedVersion, logger,
		);

		const dependentWriteTasks: (() => Promise<void>)[] = [];
		for (const dependent of dependentsToBump) {
			dependentWriteTasks.push(async () => {
				const updated = await adapter.bumpDependencyVersion(
					dependent, packageName, bumpedVersion, exact, logger,
				);
				if (updated) {
					logger.debug(styleText('dim', `Updated dependency '${packageName}' in '${dependent.name}'.`));
				}
			});
		}

		await runAsync(dependentWriteTasks, dependentWriteConcurrency);
	}
};
