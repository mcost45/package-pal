import { sep } from 'path';
import { DedupePathsBy } from '../types/dedupe-paths-by.ts';
import { assertDefined } from './assert-defined.ts';

export const dedupeSharedPaths = (paths: string[], by: DedupePathsBy) => {
	const sorted = paths.toSorted((a, b) => a.split(sep).length - b.split(sep).length);
	const deduped: string[] = [];

	if (by === DedupePathsBy.Parent) {
		for (const path of sorted) {
			if (!deduped.some(base => path.startsWith(base + sep))) {
				deduped.push(path);
			}
		}

		return deduped;
	}

	for (const path of sorted) {
		for (let i = deduped.length - 1; i >= 0; i--) {
			const base = assertDefined(deduped[i]);
			if (path.startsWith(base + sep)) {
				deduped.splice(i, 1);
			}
		}

		if (!deduped.some(base => base.startsWith(path + sep))) {
			deduped.push(path);
		}
	}

	return Array.from(new Set(deduped));
};
