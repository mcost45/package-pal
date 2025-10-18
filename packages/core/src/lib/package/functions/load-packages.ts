import { styleText } from 'node:util';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageData } from '../types/package-data.ts';
import { scanPackages } from './scan-packages.ts';

export const loadPackages = async (
	rootDir: string, packagePatterns: string[], logger: Logger,
) => {
	const patternContent = packagePatterns.map(pattern => `'${pattern}'`).join(', ');
	logger.debug(styleText('dim', `Loading packages matching pattern/s ${patternContent}...${rootDir ? ` from ${rootDir}` : ''}`));
	const packages: PackageData[] = [];
	const seen = new Set<string>();

	for await (const packageData of scanPackages(
		Array.from(new Set(packagePatterns)), logger, rootDir,
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
