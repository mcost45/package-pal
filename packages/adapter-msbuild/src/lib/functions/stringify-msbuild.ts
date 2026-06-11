import type { TNode } from 'txml/txml';
import { escapeXmlAttr } from './escape-xml.ts';

export const detectSelfClosingSpace = (raw: string): boolean => {
	const countNoSpace = (raw.match(/[^ \t\r\n]\/>/g) ?? []).length;
	const countSpace = (raw.match(/[ \t]\/>/g) ?? []).length;
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
