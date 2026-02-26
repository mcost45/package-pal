import {
	isAbsolute, join, dirname,
} from 'path';
import { isDefined } from '@package-pal/util';
import { isRootDir } from './is-root-dir.ts';
import { CONFIG_SUPPORTED_NAMES } from './validate-config-path.ts';

const dirDistLimit = 25;

const checkForConfigInDir = async (dir: string) => {
	const checks = await Promise.all(CONFIG_SUPPORTED_NAMES.map(name => Bun.file(join(dir, name)).exists()
		.then(exists => ({
			name,
			exists,
		}))));
	const found = checks.find(c => c.exists);
	return found ? join(dir, found.name) : undefined;
};

export const searchConfigPath = async (pathOverride?: string) => {
	let activeDir = process.cwd();

	if (isDefined(pathOverride)) {
		if (isAbsolute(pathOverride)) {
			return pathOverride;
		}

		return join(activeDir, pathOverride);
	}

	let trackDist = 0;
	while (!isRootDir(activeDir)) {
		if (trackDist > dirDistLimit) {
			throw new Error(`Maximum config search directory distance reached (${dirDistLimit.toString()}).`);
		}

		const configPath = await checkForConfigInDir(activeDir);

		if (configPath) {
			return configPath;
		}

		trackDist++;
		activeDir = dirname(activeDir);
	}

	return checkForConfigInDir(activeDir);
};
