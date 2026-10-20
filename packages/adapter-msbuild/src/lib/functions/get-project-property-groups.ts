import type { TNode } from 'txml/txml';

export const getProjectPropertyGroups = (dom: (TNode | string)[]): TNode[] => {
	return dom
		.filter((node): node is TNode => typeof node === 'object' && node.tagName.toLowerCase() === 'project')
		.flatMap(project => project.children)
		.filter((node): node is TNode => typeof node === 'object' && node.tagName.toLowerCase() === 'propertygroup');
};
