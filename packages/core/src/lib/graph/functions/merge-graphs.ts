import type { PackageGraph } from '../types/package-graph.ts';

export const mergeGraphs = (a: PackageGraph, b: PackageGraph) => {
	const merged: PackageGraph = new Map();

	for (const [name, node] of a) {
		merged.set(name, {
			packageData: node.packageData,
			pointsToPackages: new Set(node.pointsToPackages),
		});
	}

	for (const [name, node] of b) {
		merged.set(name, {
			packageData: node.packageData,
			pointsToPackages: new Set(node.pointsToPackages),
		});
	}

	return merged;
};
