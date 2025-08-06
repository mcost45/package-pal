import {
	getPackageCircularDependencyPaths,
	getPackageGraphs,
	getPackageOrder,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../commands/check-circular.ts';

export default async ({
	config: overrideConfigPath, noError,
}: Flags) => {
	const config = await readPackagePalConfig({ overrideConfigPath });
	const packageData = await readPackageData({ config });
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
		if (noError) {
			config.logger.info('Found circular dependencies.');
			return;
		}

		throw new Error('Found circular dependencies.');
	}

	config.logger.info('No circular dependencies found.');
};
