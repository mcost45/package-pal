import { getPathInfo } from './functions/get-path-info.js';
import { getPlatformInfo } from './functions/get-platform-info.js';
import { prepareBinary } from './functions/prepare-binary.js';
import { validateBinaryVersion } from './functions/validate-binary-version.js';

try {
	const {
		platform, targetPackage,
	} = getPlatformInfo();

	// Windows can't be optimised to run the binary directly (.exe).
	if (platform !== 'win32') {
		const {
			outputBinDir, binExecutableName, outputBinBasePath, outputBinPath, targetBinPath, targetVersion,
		} = getPathInfo({
			platform,
			targetPackage,
		});

		await prepareBinary({
			platform,
			binExecutableName,
			targetPackage,
			targetBinPath,
			outputBinDir,
			outputBinBasePath,
			outputBinPath,
		});
		validateBinaryVersion(targetVersion, outputBinPath);
	}
} catch (e) {
	throw new Error('Post install failed to install CLI binary.', { cause: e });
}
