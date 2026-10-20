import type { XML } from 'bun';
import {
	attribute, elementText, elements, propertyGroups,
} from './xml.ts';

export const collectPropertiesFromDom = (
	root: XML.Node,
	filePath: string,
	propertyMap: Map<string, {
		value: string;
		filePath: string;
	}>,
): void => {
	for (const group of propertyGroups(root)) {
		if (attribute(group, 'Condition') !== undefined) continue;
		for (const property of elements(group)) {
			if (attribute(property, 'Condition') !== undefined) continue;
			const value = elementText(property);
			if (value) propertyMap.set(property.name.toLowerCase(), {
				value,
				filePath,
			});
		}
	}
};
