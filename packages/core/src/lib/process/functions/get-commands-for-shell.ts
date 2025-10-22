import {
	escapeShellArg,
	getShell, Shell,
} from '@package-pal/util';
import { parsePsShellFlags } from './parse-ps-shell-flags.ts';

export const getCommandsForShell = (shellCommand: string): string[] => {
	const shell = getShell();

	switch (shell) {
		case Shell.cmd:
			return [
				shell,
				'/c',
				escapeShellArg(shellCommand, shell),
			];

		case Shell.pwsh:
		case Shell.powershell:
			const {
				flags, command, isPreEncoded,
			} = parsePsShellFlags(shellCommand);

			if (isPreEncoded) {
				return [shell, shellCommand];
			}

			const encodedCommand = Buffer.from(command || ' ', 'utf16le').toString('base64');
			return [
				shell,
				...flags,
				...(encodedCommand ? ['-EncodedCommand', encodedCommand] : []),
			];

		default:
			return [
				shell,
				'-c',
				escapeShellArg(shellCommand, shell),
			];
	}
};
