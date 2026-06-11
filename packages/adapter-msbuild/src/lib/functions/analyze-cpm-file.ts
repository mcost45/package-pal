import { parse } from 'txml/txml';
import { collectNodesByTags } from './find-nodes.ts';
import { getElementTextFromNode } from './get-element-text.ts';

export interface CpmStatus {
	enabled: boolean;
	hasPackage: boolean;
}

export const analyzeCpmFile = (cpmRaw: string,
	packageName: string): CpmStatus => {
	const dom = parse(cpmRaw, {
		keepComments: true,
		keepWhitespace: true,
	});
	const collected = collectNodesByTags(dom, new Set([
		'ManagePackageVersionsCentrally',
		'PackageVersion',
		'PackageReference',
	]));

	// Check if ManagePackageVersionsCentrally is explicitly false
	const manageCentralNodes = collected.ManagePackageVersionsCentrally ?? [];
	for (const node of manageCentralNodes) {
		const text = getElementTextFromNode(node);
		if (text?.toLowerCase() === 'false') {
			return {
				enabled: false,
				hasPackage: false,
			};
		}
	}

	// Check if CPM file contains the target PackageVersion or PackageReference
	let hasPackage = false;
	const packageNodes = [...(collected.PackageVersion ?? []), ...(collected.PackageReference ?? [])];

	for (const node of packageNodes) {
		const keys = Object.keys(node.attributes);
		const includeKey = keys.find(k => k.toLowerCase() === 'include');
		const updateKey = keys.find(k => k.toLowerCase() === 'update');
		const includeVal = includeKey ? node.attributes[includeKey] : undefined;
		const updateVal = updateKey ? node.attributes[updateKey] : undefined;

		if (includeVal === packageName || updateVal === packageName) {
			hasPackage = true;
			break;
		}
	}

	return {
		enabled: true,
		hasPackage,
	};
};
