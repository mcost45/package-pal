import type { Prettify } from '@package-pal/util';
import type { BumpVersionType } from './bump-version-type.ts';
import type { ConfigOptions } from './config-options.ts';
import type { PackageGraphsOptions } from './package-graphs-options.ts';
import type { PackageNameOptions } from './package-name-options.ts';

export type BumpPackageVersionOptions = Readonly<Prettify<ConfigOptions & PackageGraphsOptions & PackageNameOptions & {
	type: BumpVersionType;
	preId?: string;
	exact?: boolean;
}>>;
