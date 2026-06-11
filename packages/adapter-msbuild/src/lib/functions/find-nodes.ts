import type { TNode } from 'txml/txml';

const traverseFind = (
	node: TNode | string, tagName: string, result: TNode[],
) => {
	if (node && typeof node === 'object') {
		if (node.tagName === tagName) {
			result.push(node);
		}
		if (Array.isArray(node.children)) {
			for (const child of node.children) {
				traverseFind(
					child, tagName, result,
				);
			}
		}
	}
};

export const findNodes = (nodes: (TNode | string)[], tagName: string): TNode[] => {
	const result: TNode[] = [];
	for (const node of nodes) {
		traverseFind(
			node, tagName, result,
		);
	}
	return result;
};

const traverseCollect = (
	node: TNode | string,
	tagNames: Set<string>,
	result: Record<string, TNode[]>,
) => {
	if (node && typeof node === 'object') {
		if (tagNames.has(node.tagName)) {
			const list = result[node.tagName];
			if (list) {
				list.push(node);
			}
		}
		if (Array.isArray(node.children)) {
			for (const child of node.children) {
				traverseCollect(
					child, tagNames, result,
				);
			}
		}
	}
};

export const collectNodesByTags = (nodes: (TNode | string)[],
	tagNames: Set<string>): Record<string, TNode[]> => {
	const result: Record<string, TNode[]> = {};
	for (const tagName of tagNames) {
		result[tagName] = [];
	}

	for (const node of nodes) {
		traverseCollect(
			node, tagNames, result,
		);
	}

	return result;
};
