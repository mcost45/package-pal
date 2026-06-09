import {
	dirname, basename, resolve,
} from 'path';
import type { PackageData } from '@package-pal/core';
import { normalisePath } from '@package-pal/util';
import type { TNode } from 'txml/txml';
import { findNodes } from './find-nodes.ts';
import { getElementText } from './get-element-text.ts';
import { resolveMsbuildName } from './resolve-msbuild-name.ts';

export const parseMsbuild = (
	path: string,
	text: string,
	dom: (TNode | string)[],
	pathToName: Map<string, string>,
): PackageData | undefined => {
	const name = resolveMsbuildName(path, dom);
	const currentVersion = getElementText(dom, 'Version') ?? getElementText(dom, 'VersionPrefix');

	const localDependencies: string[] = [];
	const projectRefs = findNodes(dom, 'ProjectReference');

	for (const ref of projectRefs) {
		const includePath = ref.attributes.Include;
		if (includePath) {
			// Normalize Windows vs Unix paths
			const normalizedInclude = normalisePath(includePath);
			const absoluteRefPath = normalisePath(resolve(dirname(path), normalizedInclude));
			const depName = pathToName.get(absoluteRefPath);
			if (depName) {
				localDependencies.push(depName);
			}
		}
	}

	const packageRefs = findNodes(dom, 'PackageReference');
	for (const ref of packageRefs) {
		const includeName = ref.attributes.Include ?? ref.attributes.Update;
		if (includeName) {
			localDependencies.push(includeName);
		}
	}

	return {
		rawContent: text,
		name,
		path,
		dir: basename(dirname(path)),
		version: currentVersion ?? '1.0.0',
		localDependencies,
	};
};
