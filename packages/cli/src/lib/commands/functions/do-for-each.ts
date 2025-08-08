import {
	forEachPackage,
	getPackageGraphs,
	getPackageOrder,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../for-each.ts';

export default async ({
	config: overrideConfigPath, parallel, topological,
}: Flags, rawCommand: string) => {
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
	const packageOrder = getPackageOrder({
		config,
		packageGraphs,
	});

	await forEachPackage({
		packageGraphs,
		packageOrder,
		getCommand: ({
			name, dir,
		}) => rawCommand.replaceAll('{name}', name).replaceAll('{dir}', dir),
		parallel,
		topological,
		config,
	});
};
