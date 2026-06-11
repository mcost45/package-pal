import { styleText } from 'util';
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
	const seen = new Set<string>();

	for await (const packageData of adapter.scanPackages(
		Array.from(new Set(resolvedPatterns)), logger, rootDir,
	)) {
		if (seen.has(packageData.name)) {
			continue;
		}

		seen.add(packageData.name);
		packages.push(packageData);
	}

	if (!packages.length) {
		throw new Error(`No packages found for pattern/s ${patternContent}.`);
	}

	return packages;
};
