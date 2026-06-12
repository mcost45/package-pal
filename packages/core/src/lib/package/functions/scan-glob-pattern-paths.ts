import { normalisePath } from '@package-pal/util';
import type { GlobScanOptions } from 'bun';
import {
	$, Glob,
} from 'bun';

export const scanGlobPatternPaths = (patterns: string[], options?: GlobScanOptions): AsyncIterable<string> => ({ async* [Symbol.asyncIterator]() {
	const expandedPatterns = patterns.flatMap(pattern => $.braces(pattern));
	const seenPaths = new Set<string>();

	for (const pattern of expandedPatterns) {
		const patternPaths = new Map<string, string>();

		for await (const path of new Glob(pattern).scan(options)) {
			patternPaths.set(normalisePath(path), path);
		}

		const sortedPaths = Array.from(patternPaths.entries())
			.sort(([a], [b]) => a.localeCompare(b));

		for (const [normalizedPath, path] of sortedPaths) {
			if (seenPaths.has(normalizedPath)) {
				continue;
			}

			seenPaths.add(normalizedPath);
			yield path;
		}
	}
} });
