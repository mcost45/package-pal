import type { Prettify } from '@package-pal/util';
import type * as z from 'zod/mini';
import type {
	LogLevel, Config as ConfigSchema,
} from '../schemas/config.ts';
import type { Logger } from './logger.ts';
import type { PackagesReadyCallbackProps } from './packages-ready-callback-props.ts';
import type { ProcessPackageCallbackProps } from './process-package-callback-props.ts';
import type { SubprocessCallback } from './subprocess-callback.ts';

export type SchemaLogLevel = Prettify<z.infer<typeof LogLevel>>;

export type SchemaConfig = z.infer<typeof ConfigSchema>;

export interface NonSchemaConfig {
	logger?: Logger;
	watch?: { hooks?: {
		onBeforeProcessPackage?: SubprocessCallback<ProcessPackageCallbackProps>;
		onProcessPackage?: SubprocessCallback<ProcessPackageCallbackProps>;
		onProcessPackageError?: SubprocessCallback<ProcessPackageCallbackProps>;
		onAfterProcessPackage?: SubprocessCallback<ProcessPackageCallbackProps>;
		onBeforePackagesReady?: SubprocessCallback<PackagesReadyCallbackProps>;
		onPackagesReady?: SubprocessCallback<PackagesReadyCallbackProps>;
		onAfterPackagesReady?: SubprocessCallback<PackagesReadyCallbackProps>;
	}; };
}

export type Config = Prettify<Readonly<SchemaConfig & NonSchemaConfig>, true>;
