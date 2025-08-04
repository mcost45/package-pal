import { assertDefined } from '@package-pal/util';
import type { PackageData } from '../../package/types/package-data.ts';
import type { PackageGraph } from '../types/package-graph.ts';

export const dfsTraverseGraph = function* (graph: PackageGraph, traverseFromPackages: string | string[]): Generator<Readonly<PackageData>, void, undefined> {
	const visited = new Set<string>();
	const stack = Array.isArray(traverseFromPackages) ? [...traverseFromPackages] : [traverseFromPackages];

	while (stack.length) {
		const activePackage = assertDefined(stack.pop());
		if (visited.has(activePackage)) {
			continue;
		}

		visited.add(activePackage);

		const node = graph.get(activePackage);
		if (!node) {
			continue;
		}

		yield node.packageData;

		for (const dep of node.pointsToPackages) {
			if (!visited.has(dep)) {
				stack.push(dep);
			}
		}
	}
};
