import type { GlobScanOptions } from 'bun';
import { Glob } from 'bun';
import { mergeAsyncIters } from './merge-async-iters.ts';

export const scanGlobPatternPaths = (patterns: string[], options?: GlobScanOptions): AsyncIterable<string> => {
	return mergeAsyncIters(patterns.map(pattern => new Glob(pattern).scan(options)));
};
