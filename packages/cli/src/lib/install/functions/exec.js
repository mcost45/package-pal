import { execFileSync } from 'child_process';

/**
 * @param {string} binPath
 * @param {string[]} args
 */
export const exec = (binPath, args = process.argv.slice(2)) => {
	return execFileSync(
		binPath, args, { stdio: 'inherit' },
	);
};
