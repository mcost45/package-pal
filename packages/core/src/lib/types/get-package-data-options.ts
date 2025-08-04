import type { Prettify } from '@package-pal/util';
import type { ConfigOptions } from './config-options.ts';

export type GetPackageDataOptions = Readonly<Prettify<ConfigOptions>>;
