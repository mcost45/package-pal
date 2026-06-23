import {
	bumpPackageVersion,
	type BumpVersionType,
	getPackageGraphs,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../bump.ts';
import { getAdapter } from './get-adapter.ts';
import { selectBumpVersionType } from './select-bump-version-type.ts';
import { selectCascadeBumpVersionType } from './select-cascade-bump-version-type.ts';
import { selectPackage } from './select-package.ts';

export default async (
	{
		config: overrideConfigPath, exact, preid: preId, cascade,
	}: Flags,
	packageName?: string,
	type?: BumpVersionType,
) => {
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

	const isInteractive = !packageName || !type;

	packageName ??= await selectPackage(packageData);
	type ??= await selectBumpVersionType();

	let resolvedCascade = cascade;
	if (isInteractive && resolvedCascade === undefined) {
		resolvedCascade = await selectCascadeBumpVersionType();
	}

	await bumpPackageVersion({
		packageName,
		type,
		preId,
		exact,
		cascade: resolvedCascade,
		config,
		packageGraphs,
		adapter,
	});
};
