import type { Prettify } from '@package-pal/util';
import type { ConfigOptions } from './config-options.ts';
import type { PackageGraphsOptions } from './package-graphs-options.ts';
import type { PackageOrderOptions } from './package-order-options.ts';

export type GetPackageCircularDependencyPathsOptions = Readonly<Prettify<ConfigOptions & PackageGraphsOptions & PackageOrderOptions>>;
