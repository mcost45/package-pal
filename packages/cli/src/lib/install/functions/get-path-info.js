import { createRequire } from 'module';
import {
	dirname, join, resolve,
} from 'path';
import { fileURLToPath } from 'url';
import packageJson from '../../../../package.json' with { type: 'json' };

const require = createRequire(import.meta.url);

/**
 * @param {{ platform: Bun.Platform, targetPackage: string }} options
 */
export const getPathInfo = ({
	platform, targetPackage,
}) => {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const binName = Object.keys(packageJson.bin)[0];
	if (!binName) {
		throw new Error(`Expected '${targetPackage}' bin name.`);
	}

	const targetVersion = packageJson.version;
	if (!targetVersion) {
		throw new Error(`Expected '${targetPackage}' version.`);
	}

	const packageRootDir = resolve(
		__dirname, '..', '..', '..', '..',
	);

	const binExecutableName = platform === 'win32' ? `${binName}.exe` : binName;
	const outputBinDir = join(packageRootDir, 'bin');
	const outputBinBasePath = join(outputBinDir, binName);
	const outputBinPath = join(outputBinDir, binExecutableName);

	/** @type {string | null} */
	let targetBinPath;
	try {
		targetBinPath = require.resolve(join(
			'@package-pal', targetPackage, 'bin', binExecutableName,
		));
	} catch {
		targetBinPath = null;
	}

	return {
		packageRootDir,
		outputBinDir,
		binName,
		binExecutableName,
		outputBinBasePath,
		outputBinPath,
		targetBinPath,
		targetVersion,
	};
};
