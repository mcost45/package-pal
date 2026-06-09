import {
	getPackageGraphs,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../list.ts';
import { generateGraphTree } from './generate-graph-tree.ts';
import { getAdapter } from './get-adapter.ts';

export default async ({
	config: overrideConfigPath, reverse,
}: Flags,
packageName?: string) => {
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

	const tree = generateGraphTree({
		packageGraphs,
		dependents: reverse,
		packageName,
	});

	config.logger.info(tree);
};
