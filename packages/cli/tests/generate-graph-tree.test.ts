/* eslint import-x/extensions: 0 */
import type {
	PackageGraphs, PackageGraph,
} from '@package-pal/core';
import {
	expect, test, describe,
} from 'bun:test';
import { generateGraphTree } from '../src/lib/commands/functions/generate-graph-tree';

// Helper to create a PackageNode mock
const createMockNode = (
	name: string, version: string, dependencies: string[],
) => ({
	packageData: {
		name,
		version,
		path: '',
		dir: '',
		rawContent: '',
	},
	pointsToPackages: new Set(dependencies),
});

describe('generateGraphTree', () => {
	// A depends on B and C.
	// B depends on D.
	// C depends on D.
	// D has no dependencies.
	//
	// Dependents graph (reverse):
	// D is depended on by B and C.
	// B is depended on by A.
	// C is depended on by A.
	const dependenciesGraph: PackageGraph = new Map([
		['A', createMockNode(
			'A', '1.0.0', ['B', 'C'],
		)],
		['B', createMockNode(
			'B', '2.0.0', ['D'],
		)],
		['C', createMockNode(
			'C', '3.0.0', ['D'],
		)],
		['D', createMockNode(
			'D', '4.0.0', [],
		)],
	]);

	const dependentsGraph: PackageGraph = new Map([
		['D', createMockNode(
			'D', '4.0.0', ['B', 'C'],
		)],
		['B', createMockNode(
			'B', '2.0.0', ['A'],
		)],
		['C', createMockNode(
			'C', '3.0.0', ['A'],
		)],
		['A', createMockNode(
			'A', '1.0.0', [],
		)],
	]);

	const mockGraphs: PackageGraphs = {
		dependencies: dependenciesGraph,
		dependents: dependentsGraph,
	};

	test('pretty prints standard dependencies with deduplication and no color', () => {
		const tree = generateGraphTree({
			packageGraphs: mockGraphs,
			dependents: false,
			useColor: false,
		});

		expect(tree).toBe('A@1.0.0\n'
			+ '├── B@2.0.0\n'
			+ '│   └── D@4.0.0\n'
			+ '└── C@3.0.0\n'
			+ '    └── D@4.0.0');
	});

	test('pretty prints dependencies starting from a specific package', () => {
		const tree = generateGraphTree({
			packageGraphs: mockGraphs,
			dependents: false,
			packageName: 'B',
			useColor: false,
		});

		expect(tree).toBe('B@2.0.0\n'
			+ '└── D@4.0.0');
	});

	test('throws an error if specified package does not exist', () => {
		expect(() => {
			generateGraphTree({
				packageGraphs: mockGraphs,
				dependents: false,
				packageName: 'NON_EXISTENT',
				useColor: false,
			});
		}).toThrow('Package "NON_EXISTENT" not found in the workspace.');
	});

	test('pretty prints dependents (reverse graph)', () => {
		const tree = generateGraphTree({
			packageGraphs: mockGraphs,
			dependents: true,
			useColor: false,
		});

		expect(tree).toBe('D@4.0.0\n'
			+ '├── B@2.0.0\n'
			+ '│   └── A@1.0.0\n'
			+ '└── C@3.0.0\n'
			+ '    └── A@1.0.0');
	});

	test('handles circular dependencies cleanly without infinite recursion', () => {
		// Cycle: X depends on Y, Y depends on X.
		const cyclicDependencies: PackageGraph = new Map([['X', createMockNode(
			'X', '1.0.0', ['Y'],
		)], ['Y', createMockNode(
			'Y', '2.0.0', ['X'],
		)]]);

		const cyclicDependents: PackageGraph = new Map([['X', createMockNode(
			'X', '1.0.0', ['Y'],
		)], ['Y', createMockNode(
			'Y', '2.0.0', ['X'],
		)]]);

		const cyclicGraphs: PackageGraphs = {
			dependencies: cyclicDependencies,
			dependents: cyclicDependents,
		};

		const tree = generateGraphTree({
			packageGraphs: cyclicGraphs,
			dependents: false,
			useColor: false,
		});

		expect(tree).toBe('X@1.0.0\n'
			+ '└── Y@2.0.0\n'
			+ '    └── X@1.0.0 (circular)');
	});

	test('sorts roots by transitive dependency weight descending with alphabetical tie-breakers', () => {
		const dependenciesGraph: PackageGraph = new Map([
			['Z', createMockNode(
				'Z', '1.0.0', [],
			)],
			['X', createMockNode(
				'X', '1.0.0', ['Y'],
			)],
			['Y', createMockNode(
				'Y', '1.0.0', [],
			)],
		]);
		const dependentsGraph: PackageGraph = new Map([
			['Z', createMockNode(
				'Z', '1.0.0', [],
			)],
			['Y', createMockNode(
				'Y', '1.0.0', ['X'],
			)],
			['X', createMockNode(
				'X', '1.0.0', [],
			)],
		]);
		const mockGraphs: PackageGraphs = {
			dependencies: dependenciesGraph,
			dependents: dependentsGraph,
		};

		const tree = generateGraphTree({
			packageGraphs: mockGraphs,
			dependents: false,
			useColor: false,
		});

		expect(tree).toBe('X@1.0.0\n'
			+ '└── Y@1.0.0\n'
			+ '\n'
			+ 'Z@1.0.0');
	});
});
