import type { PackageChanges } from '../../watch/types/package-changes.ts';

export interface ProcessPackageCallbackProps {
	/**
	 * Package name. Shell commands returned by package-level watch hooks also receive this as `PP_PACKAGE_NAME`.
	 */
	name: string;
	/**
	 * Package directory as reported by the active adapter. Shell commands returned by package-level watch hooks also receive this as `PP_PACKAGE_DIR`.
	 */
	dir: string;
	/**
	 * File paths that triggered processing for this package.
	 */
	filePaths: string[];
	/**
	 * Abort signal for the current watch processing cycle.
	 */
	signal: AbortSignal;
	/**
	 * All package file changes included in the current watch processing cycle.
	 */
	totalChanges: PackageChanges;
	/**
	 * Package processing order grouped by packages that may process in parallel.
	 */
	totalProcessOrder: string[][];
}
