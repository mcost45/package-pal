import { Shell } from '../types/shell.ts';

export const escapeShellArg = (value: string, shell: Shell) => {
	switch (shell) {
		case Shell.cmd:
			// Escape for Windows CMD.exe
			// Wrap in double quotes and escape special chars with ^
			return `"${value.replace(/(["^&<>|%()!])/g, '^$1')}"`;

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
			return `'${value.replace(/'/g, `'\\''`)}'`;
	}
};
