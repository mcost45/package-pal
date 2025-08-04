import { assertDefined } from '@package-pal/util';
import {
	dim, yellow,
} from 'yoctocolors';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageGraph } from '../types/package-graph.ts';
import type { PackageGraphs } from '../types/package-graphs.ts';
import type { PackageOrder } from '../types/package-order.ts';
import { dfsTraverseGraphPaths } from './dfs-traverse-graph-paths.ts';
import { extractSubgraph } from './extract-subgraph.ts';

const findStronglyConnectedComponents = (graph: PackageGraph) => {
	let index = 0;
	const indices = new Map<string, number>();
	const lowlinks = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const sccs: string[][] = [];

	const strongConnect = (node: string) => {
		indices.set(node, index);
		lowlinks.set(node, index);
		index++;
		stack.push(node);
		onStack.add(node);

		const neighbors = graph.get(node)?.pointsToPackages ?? new Set();
		for (const neighbor of neighbors) {
			if (!indices.has(neighbor)) {
				strongConnect(neighbor);
				lowlinks.set(node, Math.min(assertDefined(lowlinks.get(node)), assertDefined(lowlinks.get(neighbor))));
				continue;
			}

			if (onStack.has(neighbor)) {
				lowlinks.set(node, Math.min(assertDefined(lowlinks.get(node)), assertDefined(indices.get(neighbor))));
			}
		}

		if (lowlinks.get(node) === indices.get(node)) {
			const scc: string[] = [];
			let stackNode = assertDefined(stack.pop());
			onStack.delete(stackNode);
			scc.push(stackNode);

			while (stackNode !== node) {
				stackNode = assertDefined(stack.pop());
				onStack.delete(stackNode);
				scc.push(stackNode);
			}

			const firstNode = scc[0];
			const isSelfCycle = !!firstNode && (graph.get(firstNode)?.pointsToPackages.has(firstNode) ?? false);

			if (scc.length > 1 || isSelfCycle) {
				sccs.push(scc);
			}
		}
	};

	for (const node of graph.keys()) {
		if (!indices.has(node)) {
			strongConnect(node);
		}
	}

	return sccs;
};

const findSampleCyclePath = (scc: string[], graph: PackageGraph) => {
	const sccSet = new Set(scc);

	return assertDefined(dfsTraverseGraphPaths(graph, scc).find((path) => {
		const lastPackage = path[path.length - 1];
		return path.length >= 2 && lastPackage && sccSet.has(lastPackage);
	}));
};

export const generatePackageCircularDependencyPaths = (
	{ dependents }: PackageGraphs,
	packageSorted: PackageOrder,
	logger: Logger,
) => {
	logger.debug(dim('Generating circular dependency paths...'));
	const subgraph = extractSubgraph(dependents, packageSorted.circular);
	const scss = findStronglyConnectedComponents(subgraph);
	const sampleCycles = scss.map(scc => findSampleCyclePath(scc, subgraph).reverse());

	if (sampleCycles.length) {
		const sampleCycleContents = sampleCycles
			.map((cycle, index) => {
				return `\t${(index + 1).toString()}. ` + cycle.map(name => `'${name}'`).join(' → ');
			})
			.join('\n');
		logger.warn(yellow(`${sampleCycles.length.toString()} cyclic paths found:\n${sampleCycleContents}`));
	} else {
		logger.debug(dim(`No cyclic paths found.`));
	}

	return sampleCycles;
};
