import type { TNode } from 'txml/txml';

export const findNodes = (nodes: (TNode | string)[], tagName: string): TNode[] => {
	const result: TNode[] = [];
	const traverse = (node: TNode | string) => {
		if (node && typeof node === 'object') {
			if (node.tagName === tagName) {
				result.push(node);
			}
			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}
	};
	for (const node of nodes) {
		traverse(node);
	}
	return result;
};
