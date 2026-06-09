import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageGraphs } from '../../graph/types/package-graphs.ts';
import type { BumpVersionType } from '../../types/bump-version-type.ts';
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
	 * Bumps a package's own version and updates any dependents' manifests.
	 */
	abstract updateVersion(options: {
		packageName: string;
		type: BumpVersionType;
		packageGraphs: PackageGraphs;
		preId: string | undefined;
		exact: boolean | undefined;
		logger: Logger;
	}): Promise<void>;
}
export type { PackageAdapter as IPackageAdapter };
