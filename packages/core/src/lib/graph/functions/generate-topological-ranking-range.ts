import { isDefined } from '@package-pal/util';
import type { PackageGraph } from '../types/package-graph.ts';

export const generateTopologicalRankingRange = (graph: PackageGraph, ranking: ReadonlyMap<string, number>) => {
	let min = Infinity;
	let max = -Infinity;

	for (const key of graph.keys()) {
		const rank = ranking.get(key);
		if (!isDefined(rank)) {
			continue;
		}

		if (rank < min) {
			min = rank;
		}

		if (rank > max) {
			max = rank;
		}
	}

	if (min === Infinity) {
		return [-1, -1] as const;
	}

	return [min, max] as const;
};
