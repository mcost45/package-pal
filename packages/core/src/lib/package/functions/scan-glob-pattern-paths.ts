import { mergeAsyncIters } from '@package-pal/util';
import type { GlobScanOptions } from 'bun';
import { Glob } from 'bun';

export const scanGlobPatternPaths = (patterns: string[], options?: GlobScanOptions): AsyncIterable<string> => {
	return mergeAsyncIters(patterns.map(pattern => new Glob(pattern).scan(options)));
};
