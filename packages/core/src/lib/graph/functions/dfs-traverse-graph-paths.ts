import { assertDefined } from '@package-pal/util';
import type { PackageGraph } from '../types/package-graph';

// eslint-disable-next-line @stylistic/object-curly-newline
export interface DfsTraverseGraphPathsOptions {
	/**
	 * Whether to use a global visited set to skip already visited nodes across different paths.
	 * @default true
	 */
	useGlobalVisited?: boolean; }

export const dfsTraverseGraphPaths = function* (
	graph: PackageGraph,
	traverseFromPackages: string | string[],
	options: DfsTraverseGraphPathsOptions = {},
): Generator<string[]> {
	const { useGlobalVisited = true } = options;
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

			if (useGlobalVisited && globalVisited.has(node)) {
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

			if (useGlobalVisited) {
				globalVisited.add(node);
			}
		}
	}
};
