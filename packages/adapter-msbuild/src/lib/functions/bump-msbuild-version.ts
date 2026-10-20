import type { XML } from 'bun';
import {
	appendElement, attribute, editXml, elements, propertyGroups,
} from './xml.ts';

export const bumpMsbuildVersion = (raw: string, bumpedVersion: string): string => editXml(raw, (root) => {
	const groups = propertyGroups(root).filter(group => attribute(group, 'Condition') === undefined);
	const values = groups.flatMap(elements).filter(node => attribute(node, 'Condition') === undefined);
	const versions = values.filter(node => node.name.toLowerCase() === 'version');
	const prefixes = values.filter(node => node.name.toLowerCase() === 'versionprefix');
	const suffixes = values.filter(node => node.name.toLowerCase() === 'versionsuffix');
	if (versions.length) {
		for (const node of versions) node.children = [bumpedVersion];
	} else if (prefixes.length) {
		const dash = bumpedVersion.indexOf('-');
		const prefix = suffixes.length && dash !== -1 ? bumpedVersion.slice(0, dash) : bumpedVersion;
		const suffix = dash !== -1 ? bumpedVersion.slice(dash + 1) : '';
		for (const node of prefixes) node.children = [prefix];
		for (const node of suffixes) node.children = suffix ? [suffix] : [];
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
		const version: XML.Node = {
			name: 'Version',
			attributes: {},
			children: [bumpedVersion],
		};
		appendElement(group, version);
	}
	return true;
});
