import type { TNode } from 'txml/txml';
import { getElementTextFromNode } from './get-element-text.ts';

const collectPropertiesRecursive = (
	nodes: (TNode | string)[],
	filePath: string,
	propertyMap: Map<string, {
		value: string;
		filePath: string;
	}>,
): void => {
	for (const node of nodes) {
		if (node && typeof node === 'object') {
			const tagLower = node.tagName.toLowerCase();
			if (tagLower === 'propertygroup') {
				let hasCondition = false;
				for (const key in node.attributes) {
					if (key.toLowerCase() === 'condition') {
						hasCondition = true;
						break;
					}
				}
				if (!hasCondition) {
					for (const child of node.children) {
						if (child && typeof child === 'object') {
							const propName = child.tagName;
							const textValue = getElementTextFromNode(child);
							if (textValue?.trim()) {
								propertyMap.set(propName.toLowerCase(), {
									value: textValue.trim(),
									filePath,
								});
							}
						}
					}
				}
			}
			collectPropertiesRecursive(
				node.children, filePath, propertyMap,
			);
		}
	}
};

export const collectPropertiesFromDom = (
	dom: (TNode | string)[],
	filePath: string,
	propertyMap: Map<string, {
		value: string;
		filePath: string;
	}>,
): void => {
	collectPropertiesRecursive(
		dom, filePath, propertyMap,
	);
};
