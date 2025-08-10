import {
	existsSync, mkdirSync, rmSync,
} from 'fs';
import { join } from 'path';
import { exec } from './exec.js';
import { getPathInfo } from './get-path-info.js';
import { getPlatformInfo } from './get-platform-info.js';
import { loadMissingBinary } from './load-missing-binary.js';
import { validateBinaryVersion } from './validate-binary-version.js';

export const launchFallback = async () => {
	const {
		platform, targetPackage,
	} = getPlatformInfo();
	const {
		targetBinPath, binExecutableName, outputBinDir, targetVersion,
	} = getPathInfo({
		platform,
		targetPackage,
	});
	const downloadBinarySourceDir = join(
		outputBinDir, 'source', 'bin',
	);

	if (targetBinPath) {
		rmSync(downloadBinarySourceDir, {
			force: true,
			recursive: true,
		});

		return exec(targetBinPath);
	}

	const downloadBinPath = join(downloadBinarySourceDir, binExecutableName);
	if (!existsSync(downloadBinPath)) {
		rmSync(downloadBinarySourceDir, {
			force: true,
			recursive: true,
		});
		mkdirSync(downloadBinarySourceDir, { recursive: true });
		await loadMissingBinary({
			binExecutableName,
			targetPackage,
			outputBinDir: downloadBinarySourceDir,
		});
		validateBinaryVersion(targetVersion, downloadBinPath);
	}

	return exec(downloadBinPath);
};
