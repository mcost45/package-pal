import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageData } from './package-data.ts';

export abstract class PackageAdapter {
	/**
	 * Unique identifier for the adapter (e.g., 'package-json', 'msbuild').
	 */
	abstract readonly name: string;

	/**
	 * Glob pattern matching project manifests (e.g., 'package.json', '*.*proj').
	 */
	abstract readonly manifestPattern: string;

	/**
	 * Default package glob patterns to use if none are specified.
	 */
	abstract readonly defaultPatterns: string[];

	/**
	 * Returns true if this adapter detects that it should be used for the current workspace/CWD.
	 */
	abstract detect(cwd: string): Promise<boolean>;

	/**
	 * Scans and parses all package manifests within the specified patterns.
	 * Each adapter chooses the most optimized way to scan and yield packages.
	 */
	abstract scanPackages(
		patterns: string[],
		logger: Logger,
		cwd?: string,
	): AsyncIterable<PackageData>;

	/**
	 * Bumps a package's own version in its manifest.
	 */
	abstract bumpOwnVersion(
		packageData: PackageData,
		newVersion: string,
		logger: Logger,
	): Promise<void>;

	/**
	 * Updates a dependent package's manifest to point to the new dependency version.
	 * Returns true if a modification was made.
	 */
	abstract bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger: Logger,
	): Promise<boolean>;
}
