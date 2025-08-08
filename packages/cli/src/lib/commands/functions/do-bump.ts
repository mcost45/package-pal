import {
	bumpPackageVersion,
	type BumpVersionType,
	getPackageGraphs,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../bump.ts';
import { selectBumpVersionType } from './select-bump-version-type.ts';
import { selectPackage } from './select-package.ts';

export default async (
	{
		config: overrideConfigPath, exact, preid: preId,
	}: Flags,
	packageName?: string,
	type?: BumpVersionType,
) => {
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

	packageName ??= await selectPackage(packageData);
	type ??= await selectBumpVersionType();

	await bumpPackageVersion({
		packageName,
		type,
		preId,
		exact,
		config,
		packageGraphs,
	});
};
