import { assertDefined } from '@package-pal/util';

const knownFlagsWithParams = new Set([
	'-executionpolicy',
	'-windowstyle',
	'-version',
	'-file',
	'-inputformat',
	'-outputformat',
	'-workingdirectory',
	'-psconsolefile',
	'-pshome',
	'-configurationname',
	'-argumentlist',
	'-warningaction',
	'-erroraction',
	'-informationaction',
	'-informationvariable',
	'-warningvariable',
	'-errorvariable',
	'-outvariable',
	'-outbuffer',
	'-throttlelimit',
	'-culture',
	'-uiculture',
]);

const knownFlagsNoParams = new Set([
	'-noprofile',
	'-noninteractive',
	'-nologo',
	'-sta',
	'-mta',
	'-encodedcommand',
	'-command',
	'-help',
	'-?',
	'-verbose',
	'-debug',
	'-whatif',
	'-confirm',
	'-usewindowspowershell',
	'-noexit',
]);

export const parsePsFlags = (input: string) => {
	const tokens = input.trim().split(/\s+/);
	const flags: string[] = [];
	let i = 0;

	while (i < tokens.length) {
		const token = assertDefined(tokens[i]);
		const tokenLower = token.toLowerCase();

		if (knownFlagsWithParams.has(tokenLower)) {
			if (i + 1 >= tokens.length) {
				break;
			}

			flags.push(token, assertDefined(tokens[i + 1]));
			i += 2;
			continue;
		}

		if (knownFlagsNoParams.has(tokenLower)) {
			flags.push(token);
			i += 1;
			continue;
		}

		break;
	}

	const command = tokens.slice(i).join(' ');

	return {
		flags,
		command,
	};
};
