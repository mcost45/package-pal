import { mergeAsyncIters } from '@package-pal/util';
import type { GlobScanOptions } from 'bun';
import {
	$, Glob,
} from 'bun';

export const scanGlobPatternPaths = (patterns: string[], options?: GlobScanOptions): AsyncIterable<string> => {
	const expandedPatterns = patterns.flatMap(pattern => $.braces(pattern));
	return mergeAsyncIters(expandedPatterns.map(pattern => new Glob(pattern).scan(options)));
};
