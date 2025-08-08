import {
	dirname, join,
} from 'path';
import { formatUnknownError } from '@package-pal/util';
import {
	dim, red,
} from 'yoctocolors';
import type { Logger } from '../../configuration/types/logger.ts';
import type { PackageData } from '../types/package-data.ts';
import { parsePackage } from './parse-package.ts';
import { scanPackagePaths } from './scan-package-paths.ts';

export const scanPackages = async function* (
	patterns: string[], logger: Logger, cwd?: string,
): AsyncIterable<PackageData> {
	for await (const path of scanPackagePaths(patterns, cwd)) {
		const packagePath = join(path, 'package.json');
		const dir = dirname(packagePath);

		try {
			logger.debug(dim(`Trying to read read package.json in '${dir}'.`));
			const file = Bun.file(packagePath);

			// TODO-MC: investigate file.text() hangs for non-existent file???
			if (!file.size) {
				logger.debug(dim(`Failed to read package.json in '${dir}' - ${red('File not found')}.`));
				continue;
			}

			const text = await file.text();
			const packageData = parsePackage(packagePath, text);

			if (!packageData) {
				logger.debug(dim(`Invalid package.json found in '${dir}'.`));
				continue;
			}

			logger.debug(dim(`Successfully read package.json in '${dir}'.`));
			yield packageData;
		} catch (e: unknown) {
			logger.debug(dim(`Failed to read package.json in '${dir}' - ${red(formatUnknownError(e))}.`));
		}
	}
};
