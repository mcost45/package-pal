import { normalisePath } from '@package-pal/util';
import type { GlobScanOptions } from 'bun';
import {
	$, Glob,
} from 'bun';

export const scanGlobPatternPaths = (patterns: string[], options?: GlobScanOptions): AsyncIterable<string> => ({ async* [Symbol.asyncIterator]() {
	const expandedPatterns = Array.from(new Set(patterns.flatMap(pattern => $.braces(pattern))));
	if (expandedPatterns.length === 0) {
		return;
	}

	const patternPaths = new Map<string, string>();

	// Run all glob scans in parallel to maximize filesystem throughput
	const scanPromises = expandedPatterns.map(async (pattern) => {
		const results: string[] = [];
		const glob = new Glob(pattern);
		for await (const path of glob.scan(options)) {
			if (path) {
				results.push(path);
			}
		}
		return results;
	});

	const allResults = await Promise.all(scanPromises);

	for (const results of allResults) {
		for (const path of results) {
			patternPaths.set(normalisePath(path), path);
		}
	}

	const sortedPaths = Array.from(patternPaths.entries())
		.sort(([a], [b]) => a.localeCompare(b));

	for (const [_, path] of sortedPaths) {
		yield path;
	}
} });
