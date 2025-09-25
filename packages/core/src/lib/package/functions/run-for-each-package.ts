import { dirname } from 'path';
import {
	assertDefined, runAsync,
} from '@package-pal/util';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageGraphs } from '../../graph/types/package-graphs.ts';
import type { PackageOrder } from '../../graph/types/package-order.ts';
import { runSubprocess } from '../../process/functions/run-subprocess.ts';
import { ExitState } from '../../process/types/exit-state.ts';
import type { ForEachCommandCallback } from '../../types/for-each-command-callback.ts';

export const runForEachPackage = async (
	packageGraphs: PackageGraphs,
	packageOrder: PackageOrder,
	getCommand: ForEachCommandCallback,
	logger: Logger,
	topological = true,
	concurrency?: number,
) => {
	const controller = new AbortController();
	let processPackageOrder = packageOrder.groups.concat(packageOrder.circular);
	if (!topological) {
		processPackageOrder = [processPackageOrder.flat()];
	}

	for (const group of processPackageOrder) {
		await runAsync(group.map(packageName => async () => {
			const packageNode = assertDefined(packageGraphs.dependencies.get(packageName));
			const processPackageProps = {
				name: packageName,
				dir: packageNode.packageData.dir,
			};
			const processPackageCwd = dirname(packageNode.packageData.path);

			const shellCommand = await getCommand(processPackageProps);
			if (!shellCommand) {
				return;
			}

			const exitState = await runSubprocess({
				debugName: `run for ${packageName}`,
				shellCommand: shellCommand,
				cwd: processPackageCwd,
				signal: controller.signal,
				logger,
			});

			if (exitState === ExitState.Errored) {
				controller.abort();
				throw new Error('Command failed.');
			}
		}),
		concurrency);
	}
};
