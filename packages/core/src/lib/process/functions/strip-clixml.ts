/**
 * Creates a stateful stripper for PowerShell CLIXML.
 * Buffers chunks to handle XML tags split across stream boundaries.
 */
export const createClixmlStripper = () => {
	let buffer = '';

	return (chunk: string): string => {
		buffer += chunk;

		// If no XML markers, flush buffer and return
		if (!buffer.includes('<') && !buffer.includes('#< CLIXML')) {
			const out = buffer;
			buffer = '';
			return out;
		}

		// If it has a '<' but doesn't look like an XML tag or CLIXML header,
		// it might just be a comparison operator in normal text.
		// However, to be safe, if we haven't seen the CLIXML header yet,
		// we should only buffer if we see the header or something that looks like an Obj/S tag.
		const hasClixmlHeader = buffer.includes('#< CLIXML');
		const hasClixmlTags = /<Obj|S S="Error"|<\/Objs>/.test(buffer);

		if (!hasClixmlHeader && !hasClixmlTags) {
			const out = buffer;
			buffer = '';
			return out;
		}

		// Remove handshake and progress objects
		buffer = buffer
			.replace(/#< CLIXML/g, '')
			.replace(/<Obj S="progress"[\s\S]*?<\/Obj>/g, '');

		let output = '';
		// Extract content from error string tags
		buffer = buffer.replace(/<S S="Error">([\s\S]*?)<\/S>/g, (_: string, msg: string) => {
			output += msg;
			return '';
		});

		// Clear noise if we hit the end of an XML block
		if (buffer.includes('</Objs>')) {
			// Extract any remaining text between tags before clearing
			output += buffer.replace(/<[^>]+>/g, '');
			buffer = '';
		}

		if (!output) return '';

		return output
			.replace(/_x([0-9A-F]{4})_/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
			.replace(/<[^>]+>/g, '');
	};
};
