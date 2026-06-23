import type { Prettify } from '@package-pal/util';
import type * as z from 'zod/mini';
import type {
	LogLevel, Config as ConfigSchema,
} from '../schemas/config.ts';
import type { BumpPackageCallbackProps } from './bump-package-callback-props.ts';
import type { BumpPackagesReadyCallbackProps } from './bump-packages-ready-callback-props.ts';
import type { Logger } from './logger.ts';
import type { PackagesReadyCallbackProps } from './packages-ready-callback-props.ts';
import type { ProcessPackageCallbackProps } from './process-package-callback-props.ts';
import type { SubprocessCallback } from './subprocess-callback.ts';

export type SchemaLogLevel = Prettify<z.infer<typeof LogLevel>>;

export type SchemaConfig = z.infer<typeof ConfigSchema>;

export interface NonSchemaConfig {
	logger?: Logger;
	bump?: {
		ignore?: string | string[] | undefined;
		hooks?: {
			onBeforeProcessPackage?: SubprocessCallback<BumpPackageCallbackProps>;
			onProcessPackage?: SubprocessCallback<BumpPackageCallbackProps>;
			onAfterProcessPackage?: SubprocessCallback<BumpPackageCallbackProps>;
			onBeforePackagesReady?: SubprocessCallback<BumpPackagesReadyCallbackProps>;
			onPackagesReady?: SubprocessCallback<BumpPackagesReadyCallbackProps>;
			onAfterPackagesReady?: SubprocessCallback<BumpPackagesReadyCallbackProps>;
		};
		subprocess?: { concurrency?: number | null | undefined };
	};
	watch?: { hooks?: {
		onInit?: SubprocessCallback<void>;
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
