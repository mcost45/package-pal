import {
	mkdirSync, rmSync,
} from 'fs';
import { linkExistingBinary } from './link-existing-binary.js';
import { loadMissingBinary } from './load-missing-binary.js';
import { validateBinaryVersion } from './validate-binary-version.js';

/**
 * @param {{ platform: Bun.Platform, binExecutableName: string, targetPackage: string, targetVersion: string, targetBinPath: string | null, outputBinDir: string, outputBinBasePath: string, outputBinPath: string }} options
 */
export const prepareBinary = ({
	platform, binExecutableName, targetPackage, targetVersion, targetBinPath, outputBinDir, outputBinBasePath, outputBinPath,
}) => {
	if (targetBinPath) {
		console.info(`Expected CLI binary package is available in '${targetBinPath}'.`);
		validateBinaryVersion(targetVersion, targetBinPath);
	} else {
		console.warn(`Expected CLI binary was not found for '${targetPackage}'.`);
	}

	// Windows can't be optimised to run the binary directly (.exe).
	if (platform === 'win32') {
		return;
	}

	rmSync(outputBinBasePath, { force: true });
	rmSync(outputBinPath, { force: true });
	mkdirSync(outputBinDir, { recursive: true });

	if (targetBinPath) {
		linkExistingBinary({
			platform,
			targetBinPath,
			outputBinPath,
		});
		return;
	}

	return loadMissingBinary({
		binExecutableName,
		targetPackage,
		outputBinDir,
	});
};
