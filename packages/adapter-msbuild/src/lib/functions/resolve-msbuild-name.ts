import {
	basename, extname,
} from 'path';
import type { TNode } from 'txml/txml';
import { getElementText } from './get-element-text.ts';

export const resolveMsbuildName = (path: string, dom: (TNode | string)[]): string => {
	const packageId = getElementText(dom, 'PackageId');
	if (packageId) return packageId;

	const assemblyName = getElementText(dom, 'AssemblyName');
	if (assemblyName) return assemblyName;

	// Fallback to filename without extension
	return basename(path, extname(path));
};
