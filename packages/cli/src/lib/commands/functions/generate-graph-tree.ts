import { styleText } from 'util';
import type { PackageGraphs } from '@package-pal/core';

interface GenerateGraphTreeOptions {
	packageGraphs: PackageGraphs;
	dependents?: boolean | undefined;
	packageName?: string | undefined;
	useColor?: boolean | undefined;
}

export function generateGraphTree({
	packageGraphs,
	dependents = false,
	packageName,
	useColor = true,
}: GenerateGraphTreeOptions): string {
	const graph = dependents ? packageGraphs.dependents : packageGraphs.dependencies;

	const formatNode = (name: string, version: string | undefined): string => {
		const styledName = useColor ? styleText('cyan', name) : name;
		if (version) {
			const styledVersion = useColor ? styleText('dim', `@${version}`) : `@${version}`;
			return `${styledName}${styledVersion}`;
		}
		return styledName;
	};

	const formatCircular = (): string => {
		return useColor ? styleText('bold', styleText('red', ' (circular)')) : ' (circular)';
	};

	const lines: string[] = [];
	const globalVisited = new Set<string>();

	const printNode = (
		name: string,
		prefix: string,
		isLast: boolean,
		seenInPath: Set<string>,
		isRoot: boolean,
	) => {
		const node = graph.get(name);
		const version = node?.packageData.version;

		const styledNode = formatNode(name, version);

		// Compute the current line
		let line = '';
		if (!isRoot) {
			line += prefix + (isLast ? '└── ' : '├── ');
		}
		line += styledNode;

		// Check for circular dependency in current path
		if (seenInPath.has(name)) {
			line += formatCircular();
			lines.push(line);
			return;
		}

		// Check if already visited globally
		const alreadyVisited = globalVisited.has(name);
		if (alreadyVisited && !isRoot) {
			lines.push(line);
			return;
		}

		lines.push(line);

		// Record visit
		globalVisited.add(name);

		// Recurse into children
		const childNames = Array.from(node?.pointsToPackages ?? []).sort();
		if (childNames.length > 0) {
			const nextSeenInPath = new Set(seenInPath);
			nextSeenInPath.add(name);

			const nextPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

			for (let i = 0; i < childNames.length; i++) {
				const childName = childNames[i];
				if (childName === undefined) {
					continue;
				}
				const isChildLast = i === childNames.length - 1;
				printNode(
					childName, nextPrefix, isChildLast, nextSeenInPath, false,
				);
			}
		}
	};

	if (packageName) {
		// Single package requested
		if (!graph.has(packageName)) {
			throw new Error(`Package "${packageName}" not found in the workspace.`);
		}
		printNode(
			packageName, '', true, new Set(), true,
		);
	} else {
		// Print entire graph
		// Determine root nodes:
		// - If dependents is false (dependencies direction), a root has 0 dependents (dependents in packageGraphs has 0 pointsToPackages).
		// - If dependents is true (dependents direction), a root has 0 dependencies (dependencies in packageGraphs has 0 pointsToPackages).
		const rootGraph = dependents ? packageGraphs.dependencies : packageGraphs.dependents;
		const roots: string[] = [];

		for (const [name, node] of rootGraph.entries()) {
			if (node.pointsToPackages.size === 0) {
				roots.push(name);
			}
		}

		roots.sort();

		// Print trees for all detected roots
		let first = true;
		for (const root of roots) {
			if (!first) {
				lines.push(''); // spacing between separate trees
			}
			first = false;
			printNode(
				root, '', true, new Set(), true,
			);
		}

		// Print any leftover unvisited nodes (e.g. cycles disconnected from roots)
		const leftovers = Array.from(graph.keys())
			.filter(name => !globalVisited.has(name))
			.sort();

		for (const leftover of leftovers) {
			// A leftover might have already been visited by a previous leftover tree
			if (globalVisited.has(leftover)) {
				continue;
			}
			if (!first) {
				lines.push('');
			}
			first = false;
			printNode(
				leftover, '', true, new Set(), true,
			);
		}
	}

	return lines.join('\n');
}
