import { Shell } from '../types/shell.ts';

/**
 * Escapes a string for safe use as a single shell argument (command) across different shells.
 * Ensures special characters are quoted or escaped so the argument is interpreted literally,
 * not as control operators or variable expansions.
 */
export const escapeShellArg = (value: string, shell: Shell) => {
	switch (shell) {
		case Shell.cmd: {
			// For `cmd /c`, the entire command must be wrapped in quotes.
			// Escape carets first, then other meta chars.
			// `%` is doubled to prevent env var expansion.
			// `!` is escaped as `^^!` to be safe even if delayed expansion is on.
			const escaped = value
				.replace(/\^/g, '^^^^') // Escape carets first
				.replace(/([&<>|()])/g, '^$1') // Escape other meta chars
				.replace(/!/g, '^^!') // Handle delayed expansion safely
				.replace(/%/g, '%%%%'); // Handle percents
			return `"${escaped}"`;
		}

		case Shell.powershell:
		case Shell.pwsh:
			// Escape for PowerShell (both Windows PowerShell & pwsh)
			// Wrap in single quotes, double any single quotes inside
			return `'${value.replace(/'/g, '\'\'')}'`;

		case Shell.sh:
		case Shell.bash:
		case Shell.zsh:
		case Shell.fish:
		default:
			// Escape for POSIX shells
			// Wrap in single quotes, escape single quotes inside by closing, escaping, reopening
			return `'${value.replace(/'/g, '\'\\\'\'')}'`;
	}
};
