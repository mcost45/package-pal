import type { TNode } from 'txml/txml';
import { escapeXmlAttr } from './escape-xml.ts';

export const stringifyMsbuildNode = (node: TNode | string): string => {
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
			str += stringifyMsbuildNode(child);
		}
		str += `</${node.tagName}>`;
	} else {
		str += ' />';
	}
	return str;
};

export const stringifyMsbuild = (nodes: (TNode | string)[] | TNode | string): string => {
	if (Array.isArray(nodes)) {
		return nodes.map(stringifyMsbuildNode).join('');
	}
	return stringifyMsbuildNode(nodes);
};
