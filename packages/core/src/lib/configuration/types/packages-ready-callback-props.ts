import type { PackageChanges } from '../../watch/types/package-changes.ts';

export interface PackagesReadyCallbackProps {
	/**
	 * Abort signal for the current watch processing cycle.
	 */
	signal: AbortSignal;
	/**
	 * All package file changes included in the current watch processing cycle.
	 *
	 * Shell commands returned by watch ready hooks do not receive package-specific `PP_*` environment variables.
	 */
	totalChanges: PackageChanges;
	/**
	 * Package processing order grouped by packages that may process in parallel.
	 */
	totalProcessOrder: string[][];
}
