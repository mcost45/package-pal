import {
	basename, extname,
} from 'path';
import type { TNode } from 'txml/txml';
import {
	getElementText, getElementTextFromNode,
} from './get-element-text.ts';

export const resolveMsbuildName = (
	path: string,
	dom: (TNode | string)[],
	collected?: Record<string, TNode[]>,
): string => {
	const packageIdNode = collected ? collected.PackageId?.[0] : undefined;
	const packageId = packageIdNode
		? getElementTextFromNode(packageIdNode)
		: getElementText(dom, 'PackageId');
	if (packageId) return packageId;

	const assemblyNameNode = collected ? collected.AssemblyName?.[0] : undefined;
	const assemblyName = assemblyNameNode
		? getElementTextFromNode(assemblyNameNode)
		: getElementText(dom, 'AssemblyName');
	if (assemblyName) return assemblyName;

	// Fallback to filename without extension
	return basename(path, extname(path));
};
