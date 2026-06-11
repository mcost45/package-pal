import { sep } from 'path';
import { assertDefined } from '@package-pal/util';
import { DedupePathsBy } from '../types/dedupe-paths-by.ts';

export const dedupeSharedPaths = (paths: string[], by: DedupePathsBy) => {
	const mapped = paths.map((path) => {
		let count = 0;
		for (const char of path) {
			if (char === sep) {
				count++;
			}
		}
		return {
			path,
			count,
		};
	});
	mapped.sort((a, b) => a.count - b.count);
	const sorted = mapped.map(item => item.path);
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
