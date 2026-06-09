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

export const collectNodesByTags = (nodes: (TNode | string)[],
	tagNames: Set<string>): Record<string, TNode[]> => {
	const result: Record<string, TNode[]> = {};
	for (const tagName of tagNames) {
		result[tagName] = [];
	}

	const traverse = (node: TNode | string) => {
		if (node && typeof node === 'object') {
			if (tagNames.has(node.tagName)) {
				const list = result[node.tagName];
				if (list) {
					list.push(node);
				}
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
