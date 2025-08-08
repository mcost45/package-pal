import { exec } from './exec.js';

/**
 * @param {string} targetVersion
 * @param {string} targetBinPath
 */
export const validateBinaryVersion = (targetVersion, targetBinPath) => {
	const stdout = exec(targetBinPath).toString()
		.trim();

	if (stdout.toLowerCase() !== targetVersion.toLowerCase()) {
		throw new Error(`'${targetBinPath}' binary version mismatch; expected ${targetVersion}, got ${stdout}.`);
	}
};
