import type { Prettify } from '@package-pal/util';
import type { PackageAdapter } from '../package/types/package-adapter.ts';
import type { ConfigOptions } from './config-options.ts';

export type GetPackageDataOptions = Readonly<Prettify<ConfigOptions & {
	rootDir: string;
	adapter: PackageAdapter;
}>>;
