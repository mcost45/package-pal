import {
	bumpPackageVersion,
	getPackageGraphs,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../commands/bump.ts';

export default async ({
	name: packageName, config: overrideConfigPath,
}: Flags) => {
	const config = await readPackagePalConfig({ overrideConfigPath });
	const packageData = await readPackageData({ config });
	const packageGraphs = getPackageGraphs({
		config,
		packageData,
	});
	await bumpPackageVersion({
		packageName,
		type: 'major',
		config,
		packageGraphs,
	});
};
