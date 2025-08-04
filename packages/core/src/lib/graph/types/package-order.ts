export interface PackageOrder {
	/**
	 * A topological sorted list of groups of packages.
	 * Each group is formed of independent packages, allowing for parallelized operations.
	 * Every following group is dependent on the previous groups.
	 * Packages with circular dependencies are excluded.
	 */
	groups: string[][];
	/**
	 * All packages found to contain any circular dependencies.
	 */
	circular: string[];
}
