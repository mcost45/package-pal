import type { XML } from 'bun';
import {
	attribute, elementText, properties, walkElements,
} from './xml.ts';

export interface CpmStatus {
	enabled: boolean;
	hasPackage: boolean;
}

export const analyzeCpmFile = (root: XML.Node, packageName: string): CpmStatus => {
	const disabled = properties(root).some(node => node.name.toLowerCase() === 'managepackageversionscentrally'
		&& elementText(node)?.toLowerCase() === 'false');
	return {
		enabled: !disabled,
		hasPackage: !disabled && walkElements(root).some(node => ['packagereference', 'packageversion'].includes(node.name.toLowerCase())
			&& (attribute(node, 'Include') === packageName || attribute(node, 'Update') === packageName)),
	};
};
