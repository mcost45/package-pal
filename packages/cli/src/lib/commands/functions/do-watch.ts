import {
	getPackageGraphs, readPackageData, readPackagePalConfig, watchPackages,
} from '@package-pal/core';
import { noOp } from '@package-pal/util';
import type { Flags } from '../watch.ts';
import { getAdapter } from './get-adapter.ts';

export default async ({ config: overrideConfigPath }: Flags) => {
	const {
		config, rootDir,
	} = await readPackagePalConfig({ overrideConfigPath });

	const hasWatchHooks = Object.values(config.watch.hooks).some(hook => hook !== noOp);
	if (!hasWatchHooks) {
		throw new Error('No watch hooks defined. The watch command has nothing to do; please configure at least one watch hook.');
	}

	const adapter = await getAdapter(
		config.adapter, rootDir, config.logger,
	);

	const packageData = await readPackageData({
		config,
		rootDir,
		adapter,
	});
	const packageGraphs = getPackageGraphs({
		config,
		packageData,
	});
	watchPackages({
		config,
		packageData,
		packageGraphs,
		rootDir,
	});
};
