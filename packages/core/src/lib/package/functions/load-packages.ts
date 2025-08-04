import { dim } from 'yoctocolors';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageData } from '../types/package-data.ts';
import { scanPackages } from './scan-packages.ts';

export const loadPackages = async (packagePatterns: string[], logger: Logger) => {
	const patternContent = packagePatterns.map(pattern => `'${pattern}'`).join(', ');
	logger.debug(dim(`Loading packages matching pattern/s ${patternContent}...`));
	const packages: PackageData[] = [];
	const seen = new Set<string>();

	for await (const packageData of scanPackages(Array.from(new Set(packagePatterns)), logger)) {
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
