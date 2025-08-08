import { scanGlobPatternPaths } from '@package-pal/util';

export const scanPackagePaths = (packages: string[], cwd?: string) => {
	return scanGlobPatternPaths(packages, {
		absolute: true,
		onlyFiles: false,
		cwd,
	});
};
