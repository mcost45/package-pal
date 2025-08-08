import {
	escapeShellArg,
	getShell, Shell,
} from '@package-pal/util';
import { parsePsFlags } from './parse-ps-flags.ts';

let shell: Shell | undefined;

export const getCommandsForShell = (shellCommand: string): string[] => {
	shell = shell ?? getShell();

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
				flags, command,
			} = parsePsFlags(shellCommand);
			const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
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
