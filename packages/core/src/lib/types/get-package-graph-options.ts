import type { Prettify } from '@package-pal/util';
import type { ConfigOptions } from './config-options.ts';
import type { PackageDataOptions } from './package-data-options.ts';

export type GetPackageGraphOptions = Readonly<Prettify<ConfigOptions & PackageDataOptions>>;
