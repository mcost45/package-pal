import {
	bumpPackageVersion,
	type BumpVersionType,
	getPackageGraphs,
	readPackageData,
	readPackagePalConfig,
} from '@package-pal/core';
import type { Flags } from '../commands/bump.ts';
import { selectBumpVersionType } from '../prompts/select-bump-version-type.ts';
import { selectPackage } from '../prompts/select-package.ts';

export default async (
	{
		config: overrideConfigPath, exact, preid: preId,
	}: Flags, packageName?: string, type?: BumpVersionType,
) => {
	const config = await readPackagePalConfig({ overrideConfigPath });
	const packageData = await readPackageData({ config });
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
