import { assertDefined } from '@package-pal/util';

export const generateTopologicalRanking = (packageProcessOrder: string[][]) => {
	const rankMap = new Map<string, number>();

	for (let i = 0; i < packageProcessOrder.length; i++) {
		for (const packageName of assertDefined(packageProcessOrder[i])) {
			rankMap.set(packageName, i);
		}
	}

	return rankMap as ReadonlyMap<string, number>;
};
