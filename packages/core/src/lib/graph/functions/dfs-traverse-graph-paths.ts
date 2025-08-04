import { assertDefined } from '@package-pal/util';
import type { PackageGraph } from '../types/package-graph';

export const dfsTraverseGraphPaths = function* (graph: PackageGraph, traverseFromPackages: string | string[]): Generator<string[]> {
	const globalVisited = new Set<string>();
	const startPackages = Array.isArray(traverseFromPackages) ? traverseFromPackages : [traverseFromPackages];

	for (const start of startPackages) {
		const stack: {
			node: string;
			path: string[];
			localVisited: Set<string>;
		}[] = [{
			node: start,
			path: [],
			localVisited: new Set(),
		}];

		while (stack.length) {
			const {
				node, path, localVisited,
			} = assertDefined(stack.pop());

			if (localVisited.has(node)) {
				const idx = path.indexOf(node);
				if (idx !== -1) {
					yield [...path.slice(idx), node];
				}

				continue;
			}

			if (globalVisited.has(node)) {
				continue;
			}

			const newPath = [...path, node];
			const newLocalVisited = new Set(localVisited);
			newLocalVisited.add(node);

			const neighbours = graph.get(node)?.pointsToPackages;
			let pushed = false;

			if (neighbours) {
				for (const neighbour of neighbours) {
					stack.push({
						node: neighbour,
						path: newPath,
						localVisited: newLocalVisited,
					});
					pushed = true;
				}
			}

			if (!pushed) {
				yield newPath;
			}

			globalVisited.add(node);
		}
	}
};
