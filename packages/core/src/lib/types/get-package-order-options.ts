import type { Prettify } from '@package-pal/util';
import type { ConfigOptions } from './config-options.ts';
import type { PackageGraphsOptions } from './package-graphs-options.ts';

export type GetPackageOrderOptions = Readonly<Prettify<ConfigOptions & PackageGraphsOptions>>;
