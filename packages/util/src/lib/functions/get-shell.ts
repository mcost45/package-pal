import * as process from 'node:process';
import { Shell } from '../types/shell.ts';

export const getShell = (): Shell => {
	const isWindows = process.platform === 'win32';

	if (!isWindows) {
		const envShell = (process.env.SHELL ?? '').toLowerCase();

		switch (true) {
			case envShell.includes('bash'):
				return Shell.bash;

			case envShell.includes('zsh'):
				return Shell.zsh;

			case envShell.includes('fish'):
				return Shell.fish;

			default:
				return Shell.sh;
		}
	}

	if (Bun.which(Shell.pwsh)) {
		return Shell.pwsh;
	}

	if (Bun.which(Shell.powershell)) {
		return Shell.powershell;
	}

	return Shell.cmd;
};
