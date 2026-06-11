import type { TNode } from 'txml/txml';
import { escapeXmlAttr } from './escape-xml.ts';

export const detectSelfClosingSpace = (raw: string): boolean => {
	let countNoSpace = 0;
	let countSpace = 0;
	const regex = /([^ \t\r\n])\/>|([ \t])\/>/g;
	let match;
	while ((match = regex.exec(raw)) !== null) {
		if (match[1] !== undefined) {
			countNoSpace++;
		} else if (match[2] !== undefined) {
			countSpace++;
		}
	}
	if (countNoSpace > 0 && countNoSpace > countSpace) {
		return false;
	}
	return true;
};

export const stringifyMsbuildNode = (node: TNode | string, options?: { selfClosingSpace?: boolean }): string => {
	if (typeof node === 'string') {
		return node;
	}
	let str = `<${node.tagName}`;
	for (const [key, value] of Object.entries(node.attributes)) {
		if (value === null) {
			str += ` ${key}`;
		} else {
			str += ` ${key}="${escapeXmlAttr(value)}"`;
		}
	}
	if (node.children.length > 0) {
		str += '>';
		for (const child of node.children) {
			str += stringifyMsbuildNode(child, options);
		}
		str += `</${node.tagName}>`;
	} else {
		if (options?.selfClosingSpace === false) {
			str += '/>';
		} else {
			str += ' />';
		}
	}
	return str;
};

export const stringifyMsbuild = (nodes: (TNode | string)[] | TNode | string,
	options?: { selfClosingSpace?: boolean }): string => {
	if (Array.isArray(nodes)) {
		return nodes.map(n => stringifyMsbuildNode(n, options)).join('');
	}
	return stringifyMsbuildNode(nodes, options);
};
