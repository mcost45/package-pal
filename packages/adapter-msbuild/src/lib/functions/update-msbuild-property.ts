import {
	appendElement, attribute, editXml, elements, propertyGroups,
} from './xml.ts';

export const updateMsbuildProperty = (
	raw: string, propertyName: string, newValue: string,
): string => editXml(raw, (root) => {
	const groups = propertyGroups(root).filter(group => attribute(group, 'Condition') === undefined);
	const matching = groups.flatMap(elements).filter(node => node.name.toLowerCase() === propertyName.toLowerCase()
		&& attribute(node, 'Condition') === undefined);
	if (matching.length) {
		for (const node of matching) node.children = [newValue];
	} else {
		let group = groups[0];
		if (!group) {
			group = {
				name: 'PropertyGroup',
				attributes: {},
				children: [],
			};
			appendElement(root, group);
		}
		appendElement(group, {
			name: propertyName,
			attributes: {},
			children: [newValue],
		});
	}
	return true;
});
