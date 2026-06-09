import {
	getPackageGraphs, readPackageData, readPackagePalConfig, watchPackages,
} from '@package-pal/core';
import type { Flags } from '../watch.ts';
import { getAdapter } from './get-adapter.ts';

export default async ({ config: overrideConfigPath }: Flags) => {
	const {
		config, rootDir,
	} = await readPackagePalConfig({ overrideConfigPath });

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
