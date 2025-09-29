import { exec } from './exec.js';

/**
 * @param {string | null} targetVersion
 * @param {string} targetBinPath
 */
export const validateBinaryVersion = (targetVersion, targetBinPath) => {
	if (!targetVersion) {
		throw new Error(`'${targetBinPath}' no binary version found.`);
	}

	const stdout = exec(
		targetBinPath, ['-v'], 'pipe',
	).toString()
		.trim();

	if (stdout.toLowerCase() !== targetVersion.toLowerCase()) {
		throw new Error(`'${targetBinPath}' binary version mismatch; expected ${targetVersion}, got ${stdout}.`);
	}
};
