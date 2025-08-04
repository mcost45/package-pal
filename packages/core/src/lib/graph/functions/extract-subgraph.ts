import { assertDefined } from '@package-pal/util';
import type { PackageGraph } from '../types/package-graph.ts';
import { dfsTraverseGraph } from './dfs-traverse-graph.ts';

export const extractSubgraph = (graph: PackageGraph, fromPackages: string | string[]) => {
	const reachablePackages = new Set(dfsTraverseGraph(graph, fromPackages).map(packageData => packageData.name));
	const subgraph: PackageGraph = new Map();

	for (const packageName of reachablePackages) {
		const node = assertDefined(graph.get(packageName));
		const filteredNeighbours = new Set([...node.pointsToPackages].filter(dep => reachablePackages.has(dep)));

		subgraph.set(packageName, {
			packageData: node.packageData,
			pointsToPackages: filteredNeighbours,
		});
	}

	return subgraph;
};
