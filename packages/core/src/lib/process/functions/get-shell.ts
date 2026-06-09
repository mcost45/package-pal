import { userInfo } from 'os';
import { basename } from 'path';
import {
	platform, env,
} from 'process';
import { Shell } from '../../types/shell.ts';

let cachedShell: Shell | null = null;

const cacheShell = (shell: Shell) => {
	cachedShell = shell;
	return shell;
};

const mapShell = (shellPath: string | null | undefined): Shell => {
	if (!shellPath) {
		return Shell.sh;
	}

	const name = basename(shellPath)
		.replace(/\.exe$/i, '')
		.toLowerCase();

	switch (name) {
		case 'bash':
			return Shell.bash;

		case 'zsh':
			return Shell.zsh;

		case 'fish':
			return Shell.fish;

		case 'sh':
			return Shell.sh;

		default:
			return Shell.sh;
	}
};

export const getShell = (): Shell => {
	if (cachedShell !== null) {
		return cachedShell;
	}

	if (env.ZSH_VERSION) {
		return cacheShell(Shell.zsh);
	}

	if (env.BASH_VERSION) {
		return cacheShell(Shell.bash);
	}

	if (env.FISH_VERSION) {
		return cacheShell(Shell.fish);
	}

	const isWindows = platform === 'win32';
	if (isWindows) {
		if ((env.MSYSTEM || env.MINGW_PREFIX) && Bun.which(Shell.bash)) {
			return cacheShell(Shell.bash);
		}

		if (Bun.which(Shell.pwsh)) {
			return cacheShell(Shell.pwsh);
		}

		if (Bun.which(Shell.powershell)) {
			return cacheShell(Shell.powershell);
		}

		return cacheShell(Shell.cmd);
	}

	if (env.SHELL) {
		return cacheShell(mapShell(env.SHELL));
	}

	try {
		const userShell = userInfo().shell;
		if (userShell) {
			return cacheShell(mapShell(userShell));
		}
	} catch {
		//
	}

	return cacheShell(Shell.sh);
};
