import {
	chmodSync,
	mkdirSync, rmSync,
} from 'fs';
import { join } from 'path';
import { linkExistingBinary } from './link-existing-binary.js';
import { loadMissingBinary } from './load-missing-binary.js';
import { validateBinaryVersion } from './validate-binary-version.js';

/**
 * @param {{ platform: typeof process.platform, binExecutableName: string, targetPackage: string, targetVersion: string | null, targetBinPath: string | null, outputBinDir: string, outputBinBasePath: string, outputBinPath: string }} options
 */
export const prepareBinary = ({
	platform, binExecutableName, targetPackage, targetVersion, targetBinPath, outputBinDir, outputBinBasePath, outputBinPath,
}) => {
	if (targetBinPath) {
		console.info(`Expected CLI binary package is available in '${targetBinPath}'.`);
		chmodSync(targetBinPath, 0o755);
		validateBinaryVersion(targetVersion, targetBinPath);
	} else {
		console.warn(`Expected CLI binary was not found for '${targetPackage}'.`);
	}

	// Windows can't be optimised to run the binary directly (.exe).
	if (platform === 'win32') {
		if (!targetBinPath) {
			const downloadBinarySourceDir = join(
				outputBinDir, 'source', 'bin',
			);
			mkdirSync(downloadBinarySourceDir, { recursive: true });
			return loadMissingBinary({
				binExecutableName,
				targetPackage,
				outputBinDir: downloadBinarySourceDir,
			});
		}
		return;
	}

	rmSync(outputBinBasePath, {
		force: true,
		recursive: true,
	});
	rmSync(outputBinPath, {
		force: true,
		recursive: true,
	});
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
