import { execFileSync } from 'child_process';

/**
 * @param {string} binPath
 * @param {string[]} args
 * @param {import('child_process').StdioOptions} stdio
 */
export const exec = (
	binPath, args = process.argv.slice(2), stdio = 'inherit',
) => {
	try {
		return execFileSync(
			binPath, args, { stdio },
		);
	} catch (error) {
		const exitError
			= (stdio === 'inherit'
				&& typeof error === 'object'
				&& error !== null
				&& 'status' in error
				&& typeof error.status === 'number')
				? error.status
				: undefined;
		if (exitError !== undefined) {
			process.exit(exitError);
		}

		throw error;
	}
};
