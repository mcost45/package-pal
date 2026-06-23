import { dirname } from 'path';
import { styleText } from 'util';
import {
	isDefined, runAsync,
} from '@package-pal/util';
import { inc } from 'semver';
import type { ActivatedBumpConfig } from '../../configuration/types/activated-config.ts';
import type {
	BumpPackage, BumpPackageCallbackProps,
} from '../../configuration/types/bump-package-callback-props.ts';
import { dfsTraverseGraph } from '../../graph/functions/dfs-traverse-graph.ts';
import { generateTopologicalSortedGroups } from '../../graph/functions/generate-topological-sorted-groups.ts';
import { runSubprocess } from '../../process/functions/run-subprocess.ts';
import { ExitState } from '../../process/types/exit-state.ts';
import type { BumpPackageVersionOptions } from '../../types/bump-package-version-options.ts';
import type { BumpVersionType } from '../../types/bump-version-type.ts';

const dependentWriteConcurrency = 20;

type BumpHookSubprocessOptions = Omit<Parameters<typeof runSubprocess>[0], 'debugName' | 'shellCommand'>;

const runBumpHookCommand = async (
	debugName: string,
	shellCommand: string | undefined,
	options: BumpHookSubprocessOptions,
) => {
	if (!shellCommand) {
		return;
	}

	const exitState = await runSubprocess({
		...options,
		debugName,
		shellCommand,
	});
	if (exitState === ExitState.Errored) {
		throw new Error(`Bump hook '${debugName}' failed.`);
	}
};

const toShellCommand = (value: unknown): string | undefined => {
	return typeof value === 'string' ? value : undefined;
};

const getBumpHookProps = (bumpGroups: BumpPackage[][]) => {
	return {
		totalBumps: new Map(bumpGroups.flat().map(bump => [bump.name, bump])),
		totalBumpOrder: bumpGroups.map(group => group.map(bump => bump.name)),
	};
};

const runBumpPackageHooks = async (
	bumpConfig: ActivatedBumpConfig,
	bumpGroup: BumpPackage[],
	allBumpGroups: BumpPackage[][],
	logger: BumpPackageVersionOptions['config']['logger'],
) => {
	const {
		totalBumps, totalBumpOrder,
	} = getBumpHookProps(allBumpGroups);

	await runAsync(bumpGroup.map(bump => async () => {
		const props: BumpPackageCallbackProps = {
			...bump,
			totalBumps,
			totalBumpOrder,
		};
		const cwd = dirname(bump.path);
		const env = {
			PP_PACKAGE_NAME: bump.name,
			PP_PACKAGE_DIR: bump.dir,
			PP_PACKAGE_PATH: bump.path,
			PP_PACKAGE_VERSION: bump.version,
			PP_PACKAGE_PREVIOUS_VERSION: bump.previousVersion,
			PP_PACKAGE_BUMP_TYPE: bump.type,
		};

		await runBumpHookCommand(
			`before bump ${bump.name}`,
			toShellCommand(await bumpConfig.hooks.onBeforeProcessPackage(props)),
			{
				cwd,
				env,
				logger,
			},
		);
		await runBumpHookCommand(
			`bump ${bump.name}`,
			toShellCommand(await bumpConfig.hooks.onProcessPackage(props)),
			{
				cwd,
				env,
				logger,
			},
		);
		await runBumpHookCommand(
			`after bump ${bump.name}`,
			toShellCommand(await bumpConfig.hooks.onAfterProcessPackage(props)),
			{
				cwd,
				env,
				logger,
			},
		);
	}),
	bumpConfig.subprocess.concurrency);
};

const runBumpReadyHooks = async (
	bumpConfig: ActivatedBumpConfig,
	bumpGroups: BumpPackage[][],
	logger: BumpPackageVersionOptions['config']['logger'],
) => {
	const {
		totalBumps, totalBumpOrder,
	} = getBumpHookProps(bumpGroups);

	const readyProps = {
		totalBumps,
		totalBumpOrder,
	};
	await runBumpHookCommand(
		'before bump packages ready',
		toShellCommand(await bumpConfig.hooks.onBeforePackagesReady(readyProps)),
		{ logger },
	);
	await runBumpHookCommand(
		'bump packages ready',
		toShellCommand(await bumpConfig.hooks.onPackagesReady(readyProps)),
		{ logger },
	);
	await runBumpHookCommand(
		'after bump packages ready',
		toShellCommand(await bumpConfig.hooks.onAfterPackagesReady(readyProps)),
		{ logger },
	);
};

const createBumpPackage = (packageName: string,
	options: {
		dir: string;
		path: string;
		previousVersion: string;
		version: string;
		type: BumpVersionType;
		isSourcePackage: boolean;
	}): BumpPackage => ({
	name: packageName,
	dir: options.dir,
	path: options.path,
	previousVersion: options.previousVersion,
	version: options.version,
	type: options.type,
	isSourcePackage: options.isSourcePackage,
});

export const bumpPackageVersion = async (options: BumpPackageVersionOptions): Promise<void> => {
	const exact = isDefined(options.exact) ? options.exact : options.config.version.exact;
	const preId = isDefined(options.preId) ? options.preId : options.config.version.preId;
	const {
		packageName, type, cascade, packageGraphs, adapter, config: {
			bump, logger,
		},
	} = options;

	logger.debug(styleText('dim', `Bumping package '${packageName}'...`));
	const packageNode = packageGraphs.dependencies.get(packageName);
	if (!packageNode) {
		throw new Error(`Package '${packageName}' not found.`);
	}

	const dependentsToBump = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName))
		.filter(pkg => pkg.name !== packageName);
	const bumpGroups: BumpPackage[][] = [];

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

		for (const packageGroup of packagesToProcessInOrder) {
			const groupBumps: BumpPackage[] = [];

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

				groupBumps.push(createBumpPackage(currentPackageName, {
					dir: node.packageData.dir,
					path: node.packageData.path,
					previousVersion: currentVersion,
					version: nextVersion,
					type: bumpType,
					isSourcePackage: currentPackageName === packageName,
				}));
			}

			if (groupBumps.length > 0) {
				bumpGroups.push(groupBumps);
			}
		}

		const bumpedVersionsMap = new Map<string, string>();

		for (const groupBumps of bumpGroups) {
			const groupBumpedVersionsMap = new Map(groupBumps.map(bumpPackage => [bumpPackage.name, bumpPackage.version]));
			for (const [currentPackageName, nextVersion] of groupBumpedVersionsMap) {
				bumpedVersionsMap.set(currentPackageName, nextVersion);
			}

			await runAsync(groupBumps.map(bumpPackage => async () => {
				const node = packageGraphs.dependencies.get(bumpPackage.name);
				if (!node) {
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

				logger.debug(styleText('dim', `Bumping '${bumpPackage.name}' (${bumpPackage.type}): ${bumpPackage.previousVersion} → ${bumpPackage.version}`));
				await adapter.bumpOwnVersion(
					node.packageData, bumpPackage.version, logger,
				);

				(node.packageData as { version?: string }).version = bumpPackage.version;
			}), dependentWriteConcurrency);

			await runBumpPackageHooks(
				bump, groupBumps, bumpGroups, logger,
			);
		}
	} else {
		const currentVersion = packageNode.packageData.version ?? '1.0.0';
		const bumpedVersion = inc(
			currentVersion, type, undefined, preId,
		);
		if (!bumpedVersion) {
			throw new Error(`Package '${packageName}' version '${currentVersion}' is invalid.`);
		}

		const sourceBump = createBumpPackage(packageName, {
			dir: packageNode.packageData.dir,
			path: packageNode.packageData.path,
			previousVersion: currentVersion,
			version: bumpedVersion,
			type,
			isSourcePackage: true,
		});
		bumpGroups.push([sourceBump]);

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

		await runBumpPackageHooks(
			bump, [sourceBump], bumpGroups, logger,
		);
	}

	await runBumpReadyHooks(
		bump, bumpGroups, logger,
	);
};
