import type { PackageData } from '../../package/types/package-data.ts';
import type { PackageGraph } from '../types/package-graph.ts';

const recordEqual = (a?: Record<string, unknown>, b?: Record<string, unknown>): boolean => {
	if (!a && !b) {
		return true;
	}

	if (!a || !b) {
		return false;
	}

	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) {
		return false;
	}

	return aKeys.every(key => b[key] === a[key]);
};

const isPackageDataLooseEqual = (a: PackageData, b: PackageData): boolean => {
	return a.name === b.name
		&& recordEqual(a.dependencies, b.dependencies)
		&& recordEqual(a.peerDependencies, b.peerDependencies)
		&& recordEqual(a.devDependencies, b.devDependencies);
};

export const isSubgraph = (a: PackageGraph, b: PackageGraph) => {
	for (const [key, nodeB] of b) {
		const nodeA = a.get(key);
		if (!nodeA) {
			return false;
		}

		if (!isPackageDataLooseEqual(nodeA.packageData, nodeB.packageData)) {
			return false;
		}

		for (const dep of nodeB.pointsToPackages) {
			if (!nodeA.pointsToPackages.has(dep)) {
				return false;
			}
		}
	}

	return true;
};
