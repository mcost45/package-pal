import type { PackageGraph } from './package-graph.ts';

export interface PackageGraphs {
	dependencies: PackageGraph;
	dependents: PackageGraph;
}
