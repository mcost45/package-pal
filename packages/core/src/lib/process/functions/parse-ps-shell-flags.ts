const shellFlagsWithParams = new Set([
	'-executionpolicy',
	'-windowstyle',
	'-version',
	'-encodedcommand',
	'-command',
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
	const flags = new Set<string>();

	const tokenRegex = /("[^"]*"|'[^']*'|\S+)/g;
	let match: RegExpExecArray | null;

	while ((match = tokenRegex.exec(input)) !== null) {
		const token = match[0];
		const tokenLower = token.toLowerCase();

		if (shellFlagsWithParams.has(tokenLower)) {
			flags.add(token);

			const nextMatch = tokenRegex.exec(input);
			if (nextMatch) {
				flags.add(nextMatch[0]);
			}
		} else if (shellFlagsNoParams.has(tokenLower)) {
			flags.add(token);
		} else {
			const isPreEncoded = Array.from(flags).some(flag => flag.toLowerCase() === '-encodedcommand');
			return {
				flags,
				command: input.slice(match.index),
				isPreEncoded,
			};
		}
	}

	const isPreEncoded = Array.from(flags).some(flag => flag.toLowerCase() === '-encodedcommand');
	return {
		flags,
		command: '',
		isPreEncoded,
	};
};
