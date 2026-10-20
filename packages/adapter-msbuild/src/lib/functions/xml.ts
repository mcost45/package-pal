import { XML } from 'bun';

export const parseProject = (input: string | Uint8Array): XML.Node => {
	const root = XML.parse(input, { compact: false });
	if (root.name !== 'Project') throw new SyntaxError('Expected an MSBuild <Project> document.');
	return root;
};

// Keep editable source text while honoring the encodings supported by Bun's XML parser.
export const decodeXml = (bytes: Uint8Array): string => {
	const data = Buffer.from(
		bytes.buffer, bytes.byteOffset, bytes.byteLength,
	);
	if ((data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0x3c && data[1] === 0)) {
		return new TextDecoder('utf-16le', {
			fatal: true,
			ignoreBOM: true,
		}).decode(data);
	}
	if ((data[0] === 0xfe && data[1] === 0xff) || (data[0] === 0 && data[1] === 0x3c)) {
		return new TextDecoder('utf-16be', {
			fatal: true,
			ignoreBOM: true,
		}).decode(data);
	}
	const declarationEnd = data.subarray(0, 5).toString() === '<?xml' ? data.indexOf('?>') : -1;
	const declaration = declarationEnd < 0
		? ''
		: data.toString(
				'latin1', 0, declarationEnd + 2,
			);
	const encoding = /^\s*<\?xml\s[^?]*\bencoding\s*=\s*["']([^"']+)/.exec(declaration)?.[1]?.toLowerCase();
	if (encoding === 'iso-8859-1') return data.toString('latin1');
	if (encoding && encoding !== 'utf-8' && encoding !== 'utf8') throw new SyntaxError(`Unsupported XML encoding '${encoding}'.`);
	return new TextDecoder('utf-8', {
		fatal: true,
		ignoreBOM: true,
	}).decode(data);
};

export const elements = (node: XML.Node): XML.Node[] => node.children
	.filter((child): child is XML.Node => typeof child === 'object' && 'name' in child);

export function* walkElements(root: XML.Node): Generator<XML.Node> {
	const stack = [root];
	while (stack.length) {
		const node = stack.pop();
		if (!node) break;
		yield node;
		for (let i = node.children.length - 1; i >= 0; i--) {
			const child = node.children[i];
			if (typeof child === 'object' && 'name' in child) stack.push(child);
		}
	}
}

export const attribute = (node: XML.Node, name: string): string | undefined => {
	return Object.entries(node.attributes).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
};

export const elementText = (node: XML.Node | undefined): string | undefined => {
	const value = node?.children.filter(child => typeof child === 'string').join('')
		.trim();
	return value === '' ? undefined : value;
};

export const propertyGroups = (root: XML.Node): XML.Node[] => elements(root)
	.filter(node => node.name.toLowerCase() === 'propertygroup');

export const properties = (root: XML.Node): XML.Node[] => propertyGroups(root).flatMap(elements);

export const appendElement = (parent: XML.Node, child: XML.Node): void => {
	const indent = parent.children.find(value => typeof value === 'string' && /^\s*\n[\t ]*$/.test(value));
	const last = parent.children.at(-1);
	const index = typeof last === 'string' && /^\s+$/.test(last) ? parent.children.length - 1 : parent.children.length;
	parent.children.splice(
		index, 0, ...(typeof indent === 'string' ? [indent, child] : [child]),
	);
};

// Bun represents the root element only. Retain the validated document's prolog and epilog on edits.
const rootOffset = (raw: string): number => {
	let offset = 0;
	while (offset < raw.length) {
		if (/\s|\uFEFF/.test(raw[offset] ?? '')) {
			offset++;
			continue;
		}
		if (raw.startsWith('<!--', offset)) {
			offset = raw.indexOf('-->', offset) + 3;
			continue;
		}
		if (raw.startsWith('<?', offset)) {
			offset = raw.indexOf('?>', offset) + 2;
			continue;
		}
		if (!raw.startsWith('<!DOCTYPE', offset)) return offset;
		let subset = 0;
		let quote = '';
		for (offset += 9; offset < raw.length; offset++) {
			const char = raw[offset];
			if (quote) {
				if (char === quote) quote = '';
				continue;
			}
			if (raw.startsWith('<!--', offset)) {
				offset = raw.indexOf('-->', offset) + 2;
				continue;
			}
			if (raw.startsWith('<?', offset)) {
				offset = raw.indexOf('?>', offset) + 1;
				continue;
			}
			if (char === '"' || char === '\'') quote = char;
			else if (char === '[') subset++;
			else if (char === ']') subset--;
			else if (char === '>' && !subset) {
				offset++;
				break;
			}
		}
	}
	return offset;
};

export const editXml = (raw: string, edit: (root: XML.Node) => boolean): string => {
	const root = parseProject(raw);
	if (!edit(root)) return raw;
	const start = rootOffset(raw);
	const tags = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;
	tags.lastIndex = start;
	let depth = 0;
	let end = start;
	for (let tag = tags.exec(raw); tag; tag = tags.exec(raw)) {
		if (tag[0].startsWith('<!') || tag[0].startsWith('<?')) continue;
		depth += tag[0].startsWith('</') ? -1 : tag[0].endsWith('/>') ? 0 : 1;
		if (!depth) {
			end = tags.lastIndex;
			break;
		}
	}
	if (end === start) throw new Error('Could not locate the XML document element.');
	const serialized = XML.stringify(root);
	const content = raw.includes('\r\n') ? serialized.replace(/\n/g, '\r\n') : serialized;
	const prefix = raw.slice(0, start).replace(/^(\uFEFF?<\?xml\s[^?]*\bencoding\s*=\s*)(["'])[^"']*\2/, '$1$2utf-8$2');
	return prefix + content + raw.slice(end);
};
