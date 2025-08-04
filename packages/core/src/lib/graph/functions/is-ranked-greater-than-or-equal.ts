import type { PackageGraph } from '../types/package-graph.ts';
import { generateTopologicalRankingRange } from './generate-topological-ranking-range.ts';

export const isRankedGreaterThanOrEqual = (
	a: PackageGraph, b: PackageGraph, ranking: ReadonlyMap<string, number>,
) => {
	const [prevMin] = generateTopologicalRankingRange(a, ranking);

	for (const key of b.keys()) {
		const rank = ranking.get(key);
		if (rank !== undefined && rank < prevMin) {
			return false;
		}
	}

	return true;
};
