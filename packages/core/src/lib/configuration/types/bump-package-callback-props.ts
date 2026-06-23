import type { BumpVersionType } from '../../types/bump-version-type.ts';

export interface BumpPackage {
	/**
	 * Package name. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_NAME`.
	 */
	name: string;
	/**
	 * Package directory as reported by the active adapter. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_DIR`.
	 */
	dir: string;
	/**
	 * Package manifest path. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_PATH`.
	 */
	path: string;
	/**
	 * Version before the bump. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_PREVIOUS_VERSION`.
	 */
	previousVersion: string;
	/**
	 * Version after the bump. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_VERSION`.
	 */
	version: string;
	/**
	 * Bump type used for this package. Shell commands returned by package-level bump hooks also receive this as `PP_PACKAGE_BUMP_TYPE`.
	 */
	type: BumpVersionType;
	/**
	 * True for the package explicitly selected for the bump; false for cascade-bumped dependents.
	 */
	isSourcePackage: boolean;
}

export interface BumpPackageCallbackProps extends BumpPackage {
	/**
	 * All packages whose own version was bumped, keyed by package name.
	 */
	totalBumps: Map<string, BumpPackage>;
	/**
	 * Bumped package order grouped by packages that were bumped in the same topological phase.
	 */
	totalBumpOrder: string[][];
}
