/* eslint import-x/extensions: 0 */
import {
	expect, test, describe,
} from 'bun:test';
import { dfsTraverseGraph } from '../src/lib/graph/functions/dfs-traverse-graph';
import { dfsTraverseGraphPaths } from '../src/lib/graph/functions/dfs-traverse-graph-paths';
import { extractSubgraph } from '../src/lib/graph/functions/extract-subgraph';
import { generateTopologicalSortedGroups } from '../src/lib/graph/functions/generate-topological-sorted-groups';
import type { PackageGraph } from '../src/lib/graph/types/package-graph';

describe('dfsTraverseGraphPaths', () => {
	test('skips globally visited nodes by default', () => {
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}],
		]);

		const paths = Array.from(dfsTraverseGraphPaths(
			graph, ['A', 'C'], { useGlobalVisited: true },
		));
		expect(paths).toEqual([['A', 'B']]);
	});

	test('traverses all paths when useGlobalVisited is false', () => {
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B']),
			}],
		]);

		const paths = Array.from(dfsTraverseGraphPaths(
			graph, ['A', 'C'], { useGlobalVisited: false },
		));
		expect(paths).toEqual([['A', 'B'], ['C', 'B']]);
	});

	test('detects cycles in a cyclic graph', () => {
		const graph: PackageGraph = new Map([['A', {
			packageData: {
				name: 'A',
				path: '',
				dir: '',
				rawContent: '',
			},
			pointsToPackages: new Set(['B']),
		}], ['B', {
			packageData: {
				name: 'B',
				path: '',
				dir: '',
				rawContent: '',
			},
			pointsToPackages: new Set(['A']),
		}]]);

		const paths = Array.from(dfsTraverseGraphPaths(graph, 'A'));
		expect(paths).toContainEqual([
			'A',
			'B',
			'A',
		]);
	});

	test('handles self-cycles correctly', () => {
		const graph: PackageGraph = new Map([['A', {
			packageData: {
				name: 'A',
				path: '',
				dir: '',
				rawContent: '',
			},
			pointsToPackages: new Set(['A']),
		}]]);

		const paths = Array.from(dfsTraverseGraphPaths(graph, 'A'));
		expect(paths).toEqual([['A', 'A']]);
	});
});

describe('dfsTraverseGraph', () => {
	test('traverses nodes depth-first and yields packageData', () => {
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B', 'C']),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['D']),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
			['D', {
				packageData: {
					name: 'D',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
		]);

		const result = Array.from(dfsTraverseGraph(graph, 'A')).map(pkg => pkg.name);
		// DFS Order starting from A (pop resolves right-most child C first or left-most depending on order)
		// Active stack: [A] -> pop A, push B, C -> Active stack: [B, C] -> pop C -> Active stack: [B] -> pop B, push D -> pop D
		expect(result).toEqual([
			'A',
			'C',
			'B',
			'D',
		]);
	});
});

describe('extractSubgraph', () => {
	test('extracts correct induced subgraph from starting nodes', () => {
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B', 'C']),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['D']),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
			['D', {
				packageData: {
					name: 'D',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
		]);

		const subgraph = extractSubgraph(graph, 'B');
		expect(Array.from(subgraph.keys()).sort()).toEqual(['B', 'D']);
		expect(subgraph.get('B')?.pointsToPackages).toEqual(new Set(['D']));
		expect(subgraph.get('D')?.pointsToPackages).toEqual(new Set());
	});
});

describe('generateTopologicalSortedGroups', () => {
	test('sorts circular dependencies by in-degree and breaks ties alphabetically', () => {
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['C']),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['A']),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['A', 'B']),
			}],
		]);

		const order = generateTopologicalSortedGroups(graph);
		expect(order.circular).toEqual([
			'C',
			'A',
			'B',
		]);
	});

	test('sorts a diamond graph correctly into sequential parallelizable groups', () => {
		// A -> B, A -> C, B -> D, C -> D (A is dependency, D is dependent)
		// So D depends on B, C which depend on A.
		// Adjacency format for packageGraph is pointsToPackages (which represents dependencies)
		// D depends on B, C: D points to B, C
		// B depends on A: B points to A
		// C depends on A: C points to A
		// A has no dependencies: A points to empty
		const graph: PackageGraph = new Map([
			['A', {
				packageData: {
					name: 'A',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(),
			}],
			['B', {
				packageData: {
					name: 'B',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['A']),
			}],
			['C', {
				packageData: {
					name: 'C',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['A']),
			}],
			['D', {
				packageData: {
					name: 'D',
					path: '',
					dir: '',
					rawContent: '',
				},
				pointsToPackages: new Set(['B', 'C']),
			}],
		]);

		const order = generateTopologicalSortedGroups(graph);
		expect(order.groups).toEqual([
			['A'],
			['B', 'C'],
			['D'],
		]);
	});
});
