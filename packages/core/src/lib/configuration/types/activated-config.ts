import type { DeepRequired } from '@package-pal/util';
import type { Config } from './config.ts';

export type ActivatedConfig = DeepRequired<Config>;

export type ActivatedBumpConfig = ActivatedConfig['bump'];

export type ActivatedWatchConfig = ActivatedConfig['watch'];

export interface ActivatedConfigAndRootDir {
	config: ActivatedConfig;
	rootDir: string;
}
