import type { PackageGraph } from '../types/package-graph.ts';

export const isDisjoint = (a: PackageGraph, b: PackageGraph): boolean => {
	for (const key of a.keys()) {
		if (b.has(key)) {
			return false;
		}
	}

	return true;
};
