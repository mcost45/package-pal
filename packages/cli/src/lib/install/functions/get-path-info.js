import { readFileSync } from 'fs';
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
		throw new Error(`Expected '${packageJson.name}' bin name.`);
	}

	const baseVersion = packageJson.version;
	if (!baseVersion) {
		throw new Error(`Expected '${packageJson.name}' version.`);
	}

	const packageRootDir = resolve(
		__dirname, '..', '..', '..', '..',
	);

	const binExecutableName = platform === 'win32' ? `${binName}.exe` : binName;
	const outputBinDir = join(packageRootDir, 'bin');
	const outputBinBasePath = join(outputBinDir, binName);
	const outputBinPath = join(outputBinDir, binExecutableName);

	/** @type {string | null} */
	let targetBinPath = null;
	/** @type {string | null} */
	let targetVersion = null;
	try {
		targetBinPath = require.resolve(join(
			'@package-pal', targetPackage, 'bin', binExecutableName,
		));

		if (targetBinPath) {
			const targetPackageRoot = dirname(dirname(targetBinPath));
			const targetPackageJsonPath = join(targetPackageRoot, 'package.json');
			/** @type {Record<string, unknown> | null} */
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const targetPackageJson = JSON.parse(readFileSync(targetPackageJsonPath, { encoding: 'utf8' }));
			if (typeof targetPackageJson?.version === 'string') {
				targetVersion = targetPackageJson.version;
			}
		}
	} catch {
		//
	}

	return {
		packageRootDir,
		outputBinDir,
		binName,
		binExecutableName,
		outputBinBasePath,
		outputBinPath,
		targetBinPath,
		baseVersion,
		targetVersion,
	};
};
