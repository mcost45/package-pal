import {
	getPackageGraphs, readPackageData, readPackagePalConfig, watchPackages,
} from '@package-pal/core';
import type { Flags } from '../watch.ts';

export default async ({ config: overrideConfigPath }: Flags) => {
	const {
		config, rootDir,
	} = await readPackagePalConfig({ overrideConfigPath });
	const packageData = await readPackageData({
		config,
		rootDir,
	});
	const packageGraphs = getPackageGraphs({
		config,
		packageData,
	});
	watchPackages({
		config,
		packageData,
		packageGraphs,
	});
};
