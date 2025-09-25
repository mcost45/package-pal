import * as z from 'zod/mini';
import { zLooseFunction } from '../functions/z-loose-function.ts';
import { zLooseObjectWithoutIndexSignature } from '../functions/z-loose-object-without-index-signature.ts';

export const LogLevel = z.enum([
	'debug',
	'info',
	'warn',
	'error',
	'silent',
]);

export const Config = z.object({
	/**
	 * Tell PackagePal where to look for package.json files.
	 * @default 'packages/*'
	 * @example
	 * // ppal.config.json
	 * {
	 *   "packages": "packages/*"
	 * }
	 */
	packages: z.optional(z.union([z.string(), z.array(z.string())])),
	/**
	 * Versioning strategy.
	 */
	version: z.optional(z.object({
		/**
		 * Pre-release identifier to use when bumping versions.
		 * @default ''
		 * @example
		 * // ppal.config.json
		 * {
		 *   "preId": "beta"
		 * }
		 */
		preId: z.optional(z.string()),
		/**
		 * If true, all dependencies will be bumped to the new version exactly (no ranges or wildcards).
		 * @default false
		 */
		exact: z.optional(z.boolean()),
	})),
	/**
	 * Configuration for watching packages and triggering tasks on change.
	 */
	watch: z.optional(zLooseObjectWithoutIndexSignature({
		/**
		 * Delay (in milliseconds) before triggering after detecting a change.
		 * @default 500
		 */
		debounceMs: z.optional(z.number()),
		/**
		 * Lifecycle hooks to tap into different stages of topological package processing and readiness.
		 */
		hooks: z.optional(z.object({
			/**
			 * Called once when watch is initialised.
			 */
			onInit: z.optional(zLooseFunction()),
			/**
			 * Called before each package is processed.
			 */
			onBeforeProcessPackage: z.optional(zLooseFunction()),
			/**
			 * Called to process each package.
			 */
			onProcessPackage: z.optional(zLooseFunction()),
			/**
			 * Called if an error occurs while processing a package.
			 */
			onProcessPackageError: z.optional(zLooseFunction()),
			/**
			 * Called after each package is successfully processed.
			 */
			onAfterProcessPackage: z.optional(zLooseFunction()),
			/**
			 * Called after all packages have been processed, before packages ready.
			 */
			onBeforePackagesReady: z.optional(zLooseFunction()),
			/**
			 * Called after all packages have been processed.
			 */
			onPackagesReady: z.optional(zLooseFunction()),
			/**
			 * Called after all packages have been processed, after packages ready.
			 */
			onAfterPackagesReady: z.optional(zLooseFunction()),
		})),
		/**
		 * Subprocess behavior options when running package commands.
		 */
		subprocess: z.optional(z.object({
			/**
			 * If true, keep previous processes alive on changes when possible.
			 * @default false
			 */
			partialProcessing: z.optional(z.boolean()),
			/**
			 * If set, limits concurrency of parallel processing of (non-dependent) packages.
			 */
			concurrency: z.nullish(z.number()),
			/**
			 * A string or list of strings that indicates a long-running subprocess is "ready" - from stdout or stderr.
			 * @example
			 * { "matchLongRunningOutputAsReady": ["Listening on port"] }
			 */
			matchLongRunningOutputAsReady: z.nullish(z.union([z.string(), z.array(z.string())])),
			/**
			 * A string or list of strings that indicates a long-running subprocess has errored - from stdout or stderr.
			 * @example
			 * { "matchLongRunningOutputAsErrored": ["ERROR"] }
			 */
			matchLongRunningOutputAsErrored: z.nullish(z.union([z.string(), z.array(z.string())])),
		})),
	})),
	/**
	 * Controls the verbosity of logs.
	 * @default "info"
	 * @example
	 * { "logLevel": "debug" }
	 */
	logLevel: z.optional(LogLevel),
});
