import type { TNode } from 'txml/txml';
import { findNodes } from './find-nodes.ts';

export const getElementTextFromNode = (node: TNode | undefined): string | undefined => {
	if (node && Array.isArray(node.children) && node.children.length > 0 && typeof node.children[0] === 'string') {
		return node.children[0].trim();
	}
	return undefined;
};

export const getElementText = (nodes: (TNode | string)[], tagName: string): string | undefined => {
	const found = findNodes(nodes, tagName);
	return getElementTextFromNode(found[0]);
};
