import { styleText } from 'util';
import {
	isDefined, runAsync,
} from '@package-pal/util';
import { inc } from 'semver';
import { dfsTraverseGraph } from '../../graph/functions/dfs-traverse-graph.ts';
import type { BumpPackageVersionOptions } from '../../types/bump-package-version-options.ts';

const dependentWriteConcurrency = 20;

export const bumpPackageVersion = async (options: BumpPackageVersionOptions): Promise<void> => {
	const exact = isDefined(options.exact) ? options.exact : options.config.version.exact;
	const preId = isDefined(options.preId) ? options.preId : options.config.version.preId;
	const {
		packageName, type, packageGraphs, adapter, config: { logger },
	} = options;

	logger.debug(styleText('dim', `Bumping package '${packageName}'...`));
	const packageNode = packageGraphs.dependencies.get(packageName);
	if (!packageNode) {
		throw new Error(`Package '${packageName}' not found.`);
	}

	const currentVersion = packageNode.packageData.version ?? '1.0.0';
	const bumpedVersion = inc(
		currentVersion, type, undefined, preId,
	);
	if (!bumpedVersion) {
		throw new Error(`Package '${packageName}' version '${currentVersion}' is invalid.`);
	}

	logger.info(`Updating '${packageName}' version: ${currentVersion} → ${bumpedVersion}.`);
	await adapter.bumpOwnVersion(
		packageNode.packageData, bumpedVersion, logger,
	);

	const dependentWriteTasks: (() => Promise<void>)[] = [];
	for (const dependent of dfsTraverseGraph(packageGraphs.dependents, packageName)) {
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
};
