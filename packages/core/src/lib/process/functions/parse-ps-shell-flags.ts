import { assertDefined } from '@package-pal/util';

const shellFlagsWithParams = new Set([
	'-executionpolicy',
	'-windowstyle',
	'-version',
]);

const shellFlagsNoParams = new Set([
	'-noprofile',
	'-noninteractive',
	'-sta',
	'-mta',
	'-nologo',
	'-help',
	'-?',
	'-noexit',
	'-usewindowspowerShell',
]);

/**
 * Extracts shell-level flags from a command string
 */
export const parsePsShellFlags = (input: string) => {
	const isPreEncoded = input.toLowerCase().includes('-encodedcommand');
	const tokens = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
	const flags = new Set<string>();
	let i = 0;

	while (i < tokens.length) {
		const token = assertDefined(tokens[i]);
		const tokenLower = token.toLowerCase();

		if (shellFlagsWithParams.has(tokenLower)) {
			flags.add(token);

			if (i + 1 < tokens.length) {
				flags.add(assertDefined(tokens[i + 1]));
				i++;
			}

			i++;
		} else if (shellFlagsNoParams.has(tokenLower)) {
			flags.add(token);
			i++;
		} else {
			break;
		}
	}

	const command = tokens.slice(i).join(' ');

	return {
		flags,
		command,
		isPreEncoded,
	};
};
