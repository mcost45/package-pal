import {
	basename, extname,
} from 'path';
import type { XML } from 'bun';
import {
	elementText, properties,
} from './xml.ts';

export const resolveMsbuildName = (path: string, root: XML.Node): string => {
	const values = properties(root);
	return elementText(values.find(node => node.name.toLowerCase() === 'packageid'))
		?? elementText(values.find(node => node.name.toLowerCase() === 'assemblyname'))
		?? basename(path, extname(path));
};
