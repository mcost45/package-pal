import { sep } from 'path';
import { DedupePathsBy } from '../types/dedupe-paths-by.ts';

const isStrictDescendant = (path: string, candidateParent: string): boolean => path.startsWith(candidateParent + sep);

export const dedupeSharedPaths = (paths: string[], by: DedupePathsBy) => {
	const sortedUniquePaths = Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b));

	if (by === DedupePathsBy.Parent) {
		const deduped: string[] = [];
		let lastKept: string | undefined;

		for (const path of sortedUniquePaths) {
			if (!lastKept || !isStrictDescendant(path, lastKept)) {
				deduped.push(path);
				lastKept = path;
			}
		}

		return deduped;
	}

	const deduped: string[] = [];
	let lastKept: string | undefined;
	for (let i = sortedUniquePaths.length - 1; i >= 0; i--) {
		const path = sortedUniquePaths[i];
		if (!path) {
			continue;
		}
		if (!lastKept || !isStrictDescendant(lastKept, path)) {
			deduped.push(path);
			lastKept = path;
		}
	}

	deduped.reverse();
	return deduped;
};
