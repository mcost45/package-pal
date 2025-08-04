import {
	isAbsolute, join, dirname,
} from 'path';
import { isDefined } from '@package-pal/util';
import { isRootDir } from './is-root-dir.ts';
import { CONFIG_SUPPORTED_NAMES } from './validate-config-path.ts';

const dirDistLimit = 25;

const checkForConfigInDir = async (dir: string) => {
	return new Promise<string | undefined>((resolve) => {
		let pending = CONFIG_SUPPORTED_NAMES.length;

		for (const name of CONFIG_SUPPORTED_NAMES) {
			const pathToCheck = join(dir, name);

			void Bun.file(pathToCheck).exists()
				.then((exists) => {
					pending--;

					if (exists) {
						resolve(pathToCheck);
						return;
					}

					if (!pending) {
						resolve(undefined);
					}
				});
		}
	});
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
