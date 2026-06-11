import { parse } from 'txml/txml';
import { collectNodesByTags } from './find-nodes.ts';
import { getElementTextFromNode } from './get-element-text.ts';

export interface CpmStatus {
	enabled: boolean;
	hasPackage: boolean;
}

const cpmTags = new Set([
	'ManagePackageVersionsCentrally',
	'PackageVersion',
	'PackageReference',
]);

export const analyzeCpmFile = (cpmRaw: string,
	packageName: string): CpmStatus => {
	const dom = parse(cpmRaw, {
		keepComments: true,
		keepWhitespace: true,
	});
	const collected = collectNodesByTags(dom, cpmTags);

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
		let includeVal: string | null | undefined;
		let updateVal: string | null | undefined;

		for (const key in node.attributes) {
			const lowerKey = key.toLowerCase();
			if (lowerKey === 'include') {
				includeVal = node.attributes[key];
			} else if (lowerKey === 'update') {
				updateVal = node.attributes[key];
			}
		}

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
