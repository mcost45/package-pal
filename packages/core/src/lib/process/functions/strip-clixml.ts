import { assertDefined } from '@package-pal/util';

/**
 * Strips PowerShell's CLIXML formatting from a string.
 * This is common when PowerShell writes to stderr.
 *
 * It handles the protocol "handshake" (#< CLIXML) and extracts
 * the actual error text from the XML payload.
 */
export const stripClixml = (input: string): string => {
	if (!input.includes('#< CLIXML') && !input.includes('<Objs')) {
		return input;
	}

	// 1. Remove the handshake and progress objects entirely
	let clean = input.replace(/#< CLIXML/g, '');
	if (clean.includes('<Obj S="progress"')) {
		clean = clean.replace(/<Obj S="progress"[\s\S]*?<\/Obj>/g, '');
	}

	// 2. Extract content from ALL string tags (S) tagged as Error
	// PowerShell breaks long messages into multiple <S S="Error"> segments
	const errorRegex = /<S S="Error">([\s\S]*?)<\/S>/g;
	let match: RegExpExecArray | null;
	const parts: string[] = [];

	while ((match = errorRegex.exec(clean)) !== null) {
		parts.push(assertDefined(match[1]));
	}

	// If no specific error tags found, fallback to stripping all XML
	const result = parts.length > 0 ? parts.join('') : clean;

	return result
		// 3. Decode Hex (e.g., _x001B_ for ANSI colors or _x000D_ for newlines)
		.replace(/_x([0-9A-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
		// 4. Strip any remaining XML tags
		.replace(/<[^>]+>/g, '')
		// 5. Clean up whitespace
		.trim();
};
