import { execFileSync } from 'child_process';

/**
 * @param {string} binPath
 * @param {string[]} args
 * @param {import('child_process').StdioOptions} stdio
 */
export const exec = (
	binPath, args = process.argv.slice(2), stdio = 'inherit',
) => {
	return execFileSync(
		binPath, args, { stdio },
	);
};
