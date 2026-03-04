import type { GlobScanOptions } from 'bun';
import { scanGlobPatternPaths } from './scan-glob-pattern-paths.ts';

export const scanPackagePaths = (packages: string[], cwd?: string) => {
	const baseOpts = {
		absolute: true,
		onlyFiles: false,
	} as const satisfies Partial<GlobScanOptions>;

	const opts: GlobScanOptions = {
		...baseOpts,
		...(cwd ? { cwd } : {}),
	};

	return scanGlobPatternPaths(packages, opts);
};
