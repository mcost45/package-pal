import {
	getPackageCircularDependencyPaths,
	getPackageGraphs,
	getPackageOrder,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../check-circular.ts';
import { getAdapter } from './get-adapter.ts';

export default async ({
	config: overrideConfigPath, error,
}: Flags) => {
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
	const circularDependencyPaths = getPackageCircularDependencyPaths({
		config,
		packageGraphs,
		packageOrder,
	});

	if (circularDependencyPaths.length) {
		if (!error) {
			config.logger.warn('Found circular dependencies.');
			return;
		}

		throw new Error('Found circular dependencies.');
	}

	config.logger.info('No circular dependencies found.');
};
