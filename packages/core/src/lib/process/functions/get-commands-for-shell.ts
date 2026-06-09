import { identity } from '@package-pal/util';
import { Shell } from '../../types/shell.ts';
import { getShell } from './get-shell.ts';
import { parsePsShellFlags } from './parse-ps-shell-flags.ts';
import { createClixmlStripper } from './strip-clixml.ts';

export interface ShellCommands {
	commands: string[];
	stderrProcessor: (chunk: string) => string;
}

export const getCommandsForShell = (shellCommand: string): ShellCommands => {
	const shell = getShell();

	switch (shell) {
		case Shell.cmd:
			return {
				commands: [
					shell,
					'/c',
					shellCommand,
				],
				stderrProcessor: identity,
			};

		case Shell.pwsh:
		case Shell.powershell:
			const {
				flags, command, isPreEncoded,
			} = parsePsShellFlags(shellCommand);

			if (isPreEncoded) {
				return {
					commands: [shell, ...flags],
					stderrProcessor: createClixmlStripper(),
				};
			}

			const encodedCommand = Buffer.from(command || ' ', 'utf16le').toString('base64');
			return {
				commands: [
					shell,
					...flags,
					...(encodedCommand ? ['-EncodedCommand', encodedCommand] : []),
				],
				stderrProcessor: createClixmlStripper(),
			};

		default:
			return {
				commands: [
					shell,
					'-c',
					shellCommand,
				],
				stderrProcessor: identity,
			};
	}
};
