import {
	watch, type WatchEventType,
} from 'fs';
import {
	dirname, join,
} from 'path';
import {
	assertDefined, DedupePathsBy, dedupeSharedPaths, getDeferredPromise, getStringMatcher, isDefined, RunAsyncType, runAsync,
} from '@package-pal/util';
import {
	dim, red,
} from 'yoctocolors';
import type { ActivatedWatchConfig } from '../../configuration/types/activated-config.ts';
import type { Logger } from '../../configuration/types/logger.ts';
import { mergeGraphs } from '../../graph/functions/merge-graphs.ts';
import type { PackageGraph } from '../../graph/types/package-graph.ts';
import type { PackageGraphs } from '../../graph/types/package-graphs.ts';
import type { PackageData } from '../../package/types/package-data.ts';
import { runSubprocess } from '../../process/functions/run-subprocess.ts';
import { ExitState } from '../../process/types/exit-state.ts';
import { ChangeAction } from '../types/change-action.ts';
import type { PackageChanges } from '../types/package-changes.ts';
import { filterFilesModifiedSince } from './filter-files-modified-since.ts';
import { getChangeLogic } from './get-change-logic.ts';
import { normaliseWatchedFilePath } from './normalise-watched-file-path.ts';

const fileModifiedThresholdMs = 5000;

let lastProcessedSubgraph: PackageGraph | undefined;

const onProcessPackage = async (
	packageGraphs: PackageGraphs,
	packageChanges: PackageChanges,
	watchConfig: ActivatedWatchConfig,
	determineAbortController: (reset: boolean) => AbortController,
	logger: Logger,
) => {
	const {
		action,
		changedPackageProcessOrder,
		changedPackageSubgraph,
	} = getChangeLogic(
		packageGraphs, packageChanges, lastProcessedSubgraph, watchConfig, logger,
	);
	const controller = determineAbortController(action === ChangeAction.Restart);

	const onProcessFailure = () => {
		logger.debug(dim('Aborting controller: process failed.'));
		controller.abort();
		lastProcessedSubgraph = undefined;
	};

	if (action === ChangeAction.Ignore && packageChanges.size) {
		logger.info(`Changes detected; but were ignored due to 'partialProcessing: true'. Waiting for changes..`);
		return;
	}

	if (packageChanges.size) {
		logger.info(`Changes detected. ${action === ChangeAction.Restart ? 'Restarting processing' : 'Initiating partial processing'} ${watchConfig.subprocess.parallelProcessing ? 'in parallel' : 'sequentially'}.`);
		lastProcessedSubgraph = lastProcessedSubgraph ? mergeGraphs(lastProcessedSubgraph, changedPackageSubgraph) : changedPackageSubgraph;
	}

	for (const group of changedPackageProcessOrder) {
		const {
			promise: longRunningParallelProcessReady, resolve: matchedParallelLongReadyRunningOutput,
		} = getDeferredPromise();
		let matchedLongRunningOutputCount = 0;

		await runAsync(watchConfig.subprocess.parallelProcessing ? RunAsyncType.Parallel : RunAsyncType.Sequential, group.map(packageName => async () => {
			const {
				promise: longRunningSequentialProcessReady, resolve: matchedSequentialLongRunningReadyOutput,
			} = getDeferredPromise();

			const packageNode = assertDefined(packageGraphs.dependencies.get(packageName));
			const changedPaths = packageChanges.get(packageName) ?? [];
			const processPackageProps = {
				name: packageName,
				dir: packageNode.packageData.dir,
				filePaths: changedPaths,
				totalChanges: packageChanges,
				totalProcessOrder: changedPackageProcessOrder,
				signal: controller.signal,
			};
			const processPackageCwd = dirname(packageNode.packageData.path);

			const beforeProcessPackageShellCommand = await watchConfig.hooks.onBeforeProcessPackage(processPackageProps);
			if (beforeProcessPackageShellCommand) {
				await runSubprocess({
					debugName: `before process ${packageName}`,
					shellCommand: beforeProcessPackageShellCommand,
					cwd: processPackageCwd,
					signal: controller.signal,
					logger,
				});
			}

			const processPackageShellCommand = await watchConfig.hooks.onProcessPackage(processPackageProps);
			if (processPackageShellCommand) {
				const longRunningOutputReadyText = watchConfig.subprocess.matchLongRunningOutputAsReady;
				const longRunningOutputErroredText = watchConfig.subprocess.matchLongRunningOutputAsErrored;
				const readyMatcher = longRunningOutputReadyText ? getStringMatcher(longRunningOutputReadyText) : undefined;
				const erroredMatcher = longRunningOutputErroredText ? getStringMatcher(longRunningOutputErroredText) : undefined;
				let ready = false;
				let errored = false;

				const exit = runSubprocess({
					debugName: `process ${packageName}`,
					shellCommand: processPackageShellCommand,
					cwd: processPackageCwd,
					signal: controller.signal,
					logger,
					onStdChunk: (chunk: string) => {
						if (!ready) {
							const matchedReadyText = readyMatcher?.push(chunk).matched();

							if (matchedReadyText) {
								ready = true;
								matchedLongRunningOutputCount++;
								logger.debug(`'${packageName}' (${matchedLongRunningOutputCount.toString()}/${group.length.toString()}) subprocess matched ready text '${matchedReadyText}'.`);

								if (!watchConfig.subprocess.parallelProcessing && matchedLongRunningOutputCount) {
									matchedSequentialLongRunningReadyOutput();
								}
							}
						}

						if (!errored) {
							const matchedErrorText = erroredMatcher?.push(chunk).matched();

							if (matchedErrorText) {
								logger.error(red(`'${packageName}' subprocess matched error text '${matchedErrorText}'.`));
								errored = true;

								void Promise.resolve(watchConfig.hooks.onProcessPackageError(processPackageProps)).then((processPackageErrorCommand) => {
									if (!processPackageErrorCommand) {
										onProcessFailure();
										return;
									}

									return runSubprocess({
										debugName: `after process ${packageName}`,
										shellCommand: processPackageErrorCommand,
										cwd: processPackageCwd,
										signal: controller.signal,
										logger,
									});
								})
									.then((exitState) => {
										if (exitState === ExitState.Errored) {
											onProcessFailure();
										}
									});
							}
						}

						if (watchConfig.subprocess.parallelProcessing && matchedLongRunningOutputCount === group.length) {
							matchedParallelLongReadyRunningOutput();
						}
					},
				}).then((exitState) => {
					if (exitState === ExitState.Errored) {
						onProcessFailure();
					}
				});

				await Promise.race([
					longRunningParallelProcessReady,
					longRunningSequentialProcessReady,
					exit,
				]);
			}

			const afterProcessPackageShellCommand = await watchConfig.hooks.onAfterProcessPackage(processPackageProps);
			if (afterProcessPackageShellCommand) {
				await runSubprocess({
					debugName: `after process ${packageName}`,
					shellCommand: afterProcessPackageShellCommand,
					cwd: processPackageCwd,
					signal: controller.signal,
					logger,
				});
			}
		}));
	}

	if (packageChanges.size) {
		logger.info(`Processing ${controller.signal.aborted ? 'cancelled due to new changes' : 'completed'}.`);
	}

	const packagesReadyProps = {
		totalChanges: packageChanges,
		totalProcessOrder: changedPackageProcessOrder,
		signal: controller.signal,
	};

	const beforePackagesReadyShellCommand = await watchConfig.hooks.onBeforePackagesReady(packagesReadyProps);
	if (beforePackagesReadyShellCommand) {
		await runSubprocess({
			debugName: 'before packages ready',
			shellCommand: beforePackagesReadyShellCommand,
			signal: controller.signal,
			logger,
		});
	}

	const packagesReadyShellCommand = await watchConfig.hooks.onPackagesReady(packagesReadyProps);
	if (packagesReadyShellCommand) {
		await runSubprocess({
			debugName: 'packages ready',
			shellCommand: packagesReadyShellCommand,
			signal: controller.signal,
			logger,
		});
	}

	const afterPackagesReadyShellCommand = await watchConfig.hooks.onAfterPackagesReady(packagesReadyProps);
	if (afterPackagesReadyShellCommand) {
		await runSubprocess({
			debugName: 'after packages ready',
			shellCommand: afterPackagesReadyShellCommand,
			logger,
		});
	}
};

export const watchPackageChanges = (
	packageData: PackageData[],
	packageGraphs: PackageGraphs,
	watchConfig: ActivatedWatchConfig,
	rootDir: string,
	logger: Logger,
) => {
	const dedupedRootPackageData = dedupeSharedPaths(packageData.map(packageData => packageData.path), DedupePathsBy.Parent)
		.map(packagePath => assertDefined(packageData.find(data => data.path === packagePath)));
	logger.debug(dim(`Starting ${dedupedRootPackageData.length.toString()} watchers for ${packageData.length.toString()} packages.`));

	let closed = false;
	let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
	let startedDebounceMs: number | undefined;
	let controller: AbortController | undefined;
	const changedPackagePaths = new Map<string, Set<string>>();

	const useController = (reset: boolean) => {
		if (controller && (reset || controller.signal.aborted)) {
			if (reset) {
				logger.debug(dim('Aborting controller: reset for new packages.'));
				controller.abort();
			}
			controller = undefined;
		}

		controller ??= new AbortController();
		return controller;
	};

	const onWatchEvent = ({
		watchPath, packageName, filePath, isInitial = false,
	}: {
		watchPath?: string;
		packageName?: string;
		event?: WatchEventType;
		filePath?: string;
		isInitial?: boolean;
	}) => {
		if (!isDefined(startedDebounceMs)) {
			startedDebounceMs = Date.now();
		}

		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
		}

		if (packageName && watchPath && filePath) {
			const changedPath = join(watchPath, normaliseWatchedFilePath(filePath));
			const existingPaths = changedPackagePaths.get(packageName);
			if (existingPaths) {
				existingPaths.add(changedPath);
			} else {
				changedPackagePaths.set(packageName, new Set([changedPath]));
			}
		}

		const debounceMs = isInitial ? 0 : watchConfig.debounceMs;
		debounceTimeout = setTimeout(() => {
			if (closed) {
				return;
			}

			const packageChanges: PackageChanges = new Map();
			for (const [packageName, paths] of changedPackagePaths) {
				const dedupedPaths = dedupeSharedPaths(Array.from(paths), DedupePathsBy.Child).sort();
				const processedPaths = filterFilesModifiedSince(dedupedPaths, assertDefined(startedDebounceMs) - fileModifiedThresholdMs);
				if (processedPaths.length) {
					packageChanges.set(packageName, processedPaths);
				}
			}

			startedDebounceMs = undefined;
			changedPackagePaths.clear();

			if (!packageChanges.size && !isInitial) {
				return;
			}

			void onProcessPackage(
				packageGraphs,
				packageChanges,
				watchConfig,
				(reset: boolean) => useController(reset),
				logger,
			);
		}, debounceMs);
	};

	const watchers = dedupedRootPackageData.map(({
		name, path,
	}) => {
		const watchPath = dirname(path);

		return watch(
			watchPath, { recursive: true }, (event, filePath) => {
				onWatchEvent({
					watchPath,
					packageName: name,
					event,
					filePath: filePath ?? undefined,
				});
			},
		);
	});

	const closeWatchers = () => {
		watchers.forEach((watcher) => {
			watcher.close();
		});
		logger.debug(dim('Aborting controller: closing watchers.'));
		controller?.abort();
		closed = true;
	};

	process.on('SIGINT', () => {
		logger.debug(dim('Received SIGINT: closing watchers.'));
		closeWatchers();
		process.exit(0);
	});

	void Promise.resolve(watchConfig.hooks.onInit()).then(async (onInitShellCommand) => {
		if (onInitShellCommand) {
			await runSubprocess({
				debugName: `on init`,
				shellCommand: onInitShellCommand,
				signal: useController(false).signal,
				cwd: rootDir,
				logger,
			});
		}

		onWatchEvent({ isInitial: true });
	});

	return { close: () => {
		if (closed) {
			logger.debug(dim('Watchers already closed.'));
			return;
		}

		logger.debug(dim('Closing watchers.'));
		closeWatchers();
	} };
};
