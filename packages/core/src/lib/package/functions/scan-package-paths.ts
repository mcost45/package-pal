import { scanGlobPatternPaths } from '@package-pal/util';
import type { GlobScanOptions } from 'bun';

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
