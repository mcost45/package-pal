import type { PackageData } from '../../package/types/package-data.ts';

export interface PackageNode {
	packageData: Readonly<PackageData>;
	pointsToPackages: Readonly<Set<string>>;
}
