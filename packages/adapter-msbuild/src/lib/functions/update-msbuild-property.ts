import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { escapeXml } from './escape-xml.ts';
import {
	stringifyMsbuild, detectSelfClosingSpace,
} from './stringify-msbuild.ts';

const updatePropertyRecursive = (
	nodes: (TNode | string)[],
	propertyName: string,
	newValue: string,
	context: { found: boolean },
): void => {
	for (const node of nodes) {
		if (node && typeof node === 'object') {
			if (node.tagName.toLowerCase() === propertyName.toLowerCase()) {
				node.children = [escapeXml(newValue)];
				context.found = true;
			}
			updatePropertyRecursive(
				node.children, propertyName, newValue, context,
			);
		}
	}
};

const collectPGsRecursive = (nodes: (TNode | string)[],
	propertyGroups: TNode[]): void => {
	for (const node of nodes) {
		if (node && typeof node === 'object') {
			if (node.tagName.toLowerCase() === 'propertygroup') {
				let hasCondition = false;
				for (const key in node.attributes) {
					if (key.toLowerCase() === 'condition') {
						hasCondition = true;
						break;
					}
				}
				if (!hasCondition) {
					propertyGroups.push(node);
				}
			}
			collectPGsRecursive(node.children, propertyGroups);
		}
	}
};

export const updateMsbuildProperty = (
	raw: string, propertyName: string, newValue: string,
): string => {
	const dom = parse(raw, {
		keepComments: true,
		keepWhitespace: true,
	});

	const context = { found: false };
	updatePropertyRecursive(
		dom, propertyName, newValue, context,
	);

	if (!context.found) {
		// Fallback: If not found, try inserting into the first unconditional PropertyGroup
		const propertyGroups: TNode[] = [];
		collectPGsRecursive(dom, propertyGroups);

		const targetPG = propertyGroups[0];
		if (targetPG) {
			const propNode: TNode = {
				tagName: propertyName,
				attributes: {},
				children: [escapeXml(newValue)],
			};
			let indent = '\n  ';
			if (targetPG.children.length > 0 && typeof targetPG.children[0] === 'string') {
				const match = /^[\r\n\s]+$/.exec(targetPG.children[0]);
				if (match) {
					indent = targetPG.children[0];
				}
			}

			if (targetPG.children.length > 0) {
				const lastChild = targetPG.children[targetPG.children.length - 1];
				if (typeof lastChild === 'string' && /^[\r\n\s]+$/.test(lastChild)) {
					targetPG.children.splice(
						targetPG.children.length - 1, 0, indent, propNode,
					);
				} else {
					targetPG.children.push(indent, propNode);
				}
			} else {
				targetPG.children.push(
					indent, propNode, '\n',
				);
			}
		}
	}

	const selfClosingSpace = detectSelfClosingSpace(raw);
	return stringifyMsbuild(dom, { selfClosingSpace });
};
