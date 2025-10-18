import { styleText } from 'node:util';
import { assertDefined } from '@package-pal/util';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageGraph } from '../types/package-graph.ts';
import type { PackageOrder } from '../types/package-order.ts';

const getCircularDependencies = (inDegree: Map<string, number>) => {
	return Array.from(inDegree.keys()).sort((a, b) => {
		const degA = assertDefined(inDegree.get(a));
		const degB = assertDefined(inDegree.get(b));
		return degB - degA;
	})
		.sort();
};

export const generateTopologicalSortedGroups = (packageGraph: PackageGraph, logger: Logger): PackageOrder => {
	logger.debug(styleText('dim', 'Generating topological sorted groups...'));
	const graphEntries = Array.from(packageGraph.entries());
	const inDegree = new Map<string, number>(graphEntries.map(([packageName]) => [packageName, 0]));
	const graph = new Map<string, Set<string>>(graphEntries.map(([packageName]) => [packageName, new Set()]));

	for (const [packageName, node] of graphEntries) {
		for (const dependencyName of node.pointsToPackages) {
			assertDefined(graph.get(dependencyName)).add(packageName);
			inDegree.set(packageName, assertDefined(inDegree.get(packageName)) + 1);
		}
	}

	const result: string[][] = [];
	let ready: string[] = [];

	for (const [packageName, deg] of inDegree) {
		if (deg === 0) {
			ready.push(packageName);
		}
	}

	while (ready.length > 0) {
		result.push(ready);
		const nextReady: string[] = [];

		for (const packageName of ready) {
			inDegree.delete(packageName);
			const dependentPackages = graph.get(packageName);

			if (!dependentPackages) {
				continue;
			}

			for (const dependentPackage of dependentPackages) {
				inDegree.set(dependentPackage, assertDefined(inDegree.get(dependentPackage)) - 1);
				if (inDegree.get(dependentPackage) === 0) {
					nextReady.push(dependentPackage);
				}
			}
		}

		ready = nextReady;
	}

	logger.debug(styleText('dim', `Sorted packages into ${result.length.toString()} sequential groups of parallelizable dependencies.`));

	const circular = getCircularDependencies(inDegree);
	if (circular.length) {
		logger.warn(styleText('yellow', `${circular.length.toString()} packages could not be sorted due to circular dependencies. Correct ordering cannot be guaranteed.`));
	}

	return {
		groups: result.map(group => group.sort()),
		circular,
	};
};
