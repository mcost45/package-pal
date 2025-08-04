import type { Prettify } from '@package-pal/util';
import type { ConfigOptions } from './config-options.ts';
import type { PackageDataOptions } from './package-data-options.ts';
import type { PackageGraphsOptions } from './package-graphs-options.ts';

export type WatchPackagesOptions = Readonly<Prettify<ConfigOptions & PackageDataOptions & PackageGraphsOptions>>;
