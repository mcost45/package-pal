import { getPathInfo } from './functions/get-path-info.js';
import { getPlatformInfo } from './functions/get-platform-info.js';
import { prepareBinary } from './functions/prepare-binary.js';

try {
	const {
		platform, targetPackage,
	} = getPlatformInfo();

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
		targetVersion,
		targetBinPath,
		outputBinDir,
		outputBinBasePath,
		outputBinPath,
	});
} catch (e) {
	throw new Error('Post install failed to install CLI binary.', { cause: e });
}
