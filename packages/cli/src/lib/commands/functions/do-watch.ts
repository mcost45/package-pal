import {
	getPackageGraphs, readPackageData, readPackagePalConfig, watchPackages,
} from '@package-pal/core';
import type { Flags } from '../watch.ts';

export default async ({ config: overrideConfigPath }: Flags) => {
	const config = await readPackagePalConfig({ overrideConfigPath });
	const packageData = await readPackageData({ config });
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
