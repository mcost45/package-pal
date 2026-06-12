import { existsSync } from 'fs';
import {
	dirname, join, resolve,
} from 'path';

export const findCpmFile = (projectPath: string,
	cache?: Map<string, string | null>): string | undefined => {
	let currentDir = dirname(resolve(projectPath));
	const visitedDirs: string[] = [];

	const cacheHit = cache?.get(currentDir);
	if (cacheHit !== undefined) {
		return cacheHit ?? undefined;
	}

	let previousDir = '';
	while (currentDir !== previousDir) {
		const cached = cache?.get(currentDir);
		if (cached !== undefined) {
			for (const dir of visitedDirs) {
				cache?.set(dir, cached);
			}
			return cached ?? undefined;
		}

		const cpmPath = join(currentDir, 'Directory.Packages.props');
		if (existsSync(cpmPath)) {
			cache?.set(currentDir, cpmPath);
			for (const dir of visitedDirs) {
				cache?.set(dir, cpmPath);
			}
			return cpmPath;
		}

		visitedDirs.push(currentDir);
		previousDir = currentDir;
		currentDir = dirname(currentDir);
	}

	for (const dir of visitedDirs) {
		cache?.set(dir, null);
	}
	return undefined;
};
