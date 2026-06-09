import {
	forEachPackage,
	getPackageGraphs,
	getPackageOrder,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../for-each.ts';
import { getAdapter } from './get-adapter.ts';

export default async ({
	config: overrideConfigPath, concurrency, topological,
}: Flags, rawCommand: string) => {
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
	const packageOrder = getPackageOrder({
		config,
		packageGraphs,
	});

	await forEachPackage({
		packageGraphs,
		packageOrder,
		getCommand: () => rawCommand,
		concurrency,
		topological,
		config,
	});
};
