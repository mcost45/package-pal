import {
	mkdirSync, rmSync,
} from 'fs';
import { linkExistingBinary } from './link-existing-binary.js';
import { loadMissingBinary } from './load-missing-binary.js';

/**
 * @param {{ platform: Bun.Platform, binExecutableName: string, targetPackage: string, targetBinPath: string | null, outputBinDir: string, outputBinBasePath: string, outputBinPath: string }} options
 */
export const prepareBinary = ({
	platform, binExecutableName, targetPackage, targetBinPath, outputBinDir, outputBinBasePath, outputBinPath,
}) => {
	rmSync(outputBinBasePath, { force: true });
	rmSync(outputBinPath, { force: true });
	mkdirSync(outputBinDir, { recursive: true });

	if (targetBinPath) {
		console.info(`Expected CLI binary package is available in '${targetBinPath}'.`);
		linkExistingBinary({
			platform,
			targetBinPath,
			outputBinPath,
		});
		return Promise.resolve();
	}

	console.warn(`Expected CLI binary was not found for '${targetPackage}'.`);
	return loadMissingBinary({
		binExecutableName,
		targetPackage,
		outputBinDir,
	});
};
