import { styleText } from 'util';
import { normalisePath } from '@package-pal/util';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageAdapter } from '../types/package-adapter.ts';
import type { PackageData } from '../types/package-data.ts';

export const loadPackages = async (
	rootDir: string,
	packagePatterns: string[],
	adapter: PackageAdapter,
	logger: Logger,
) => {
	let resolvedPatterns = packagePatterns;
	if (
		packagePatterns.length === 1
		&& packagePatterns[0] === 'packages/*'
	) {
		resolvedPatterns = adapter.defaultPatterns;
	}

	const patternContent = resolvedPatterns.map(pattern => `'${pattern}'`).join(', ');
	logger.debug(styleText('dim', `Loading packages matching pattern/s ${patternContent}...${rootDir ? ` from ${rootDir}` : ''}`));
	const packages: PackageData[] = [];
	const seenByName = new Map<string, string>();

	for await (const packageData of adapter.scanPackages(
		Array.from(new Set(resolvedPatterns)), logger, rootDir,
	)) {
		const normalizedPath = normalisePath(packageData.path);
		const existingPath = seenByName.get(packageData.name);

		if (existingPath === normalizedPath) {
			continue;
		}

		if (existingPath) {
			const duplicatePaths: [string, string] = existingPath.localeCompare(normalizedPath) <= 0
				? [existingPath, normalizedPath]
				: [normalizedPath, existingPath];
			throw new Error(`Duplicate package name '${packageData.name}' found in multiple manifests: '${duplicatePaths[0]}' and '${duplicatePaths[1]}'.`);
		}

		seenByName.set(packageData.name, normalizedPath);
		packages.push(packageData);
	}

	if (!packages.length) {
		throw new Error(`No packages found for pattern/s ${patternContent}.`);
	}

	return packages.sort((a, b) => a.name.localeCompare(b.name) || normalisePath(a.path).localeCompare(normalisePath(b.path)));
};
