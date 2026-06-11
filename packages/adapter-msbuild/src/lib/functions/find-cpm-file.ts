import { existsSync } from 'fs';
import {
	dirname, join, resolve,
} from 'path';

export const findCpmFile = (projectPath: string): string | undefined => {
	let currentDir = dirname(resolve(projectPath));
	let previousDir = '';
	while (currentDir !== previousDir) {
		const cpmPath = join(currentDir, 'Directory.Packages.props');
		if (existsSync(cpmPath)) {
			return cpmPath;
		}
		previousDir = currentDir;
		currentDir = dirname(currentDir);
	}
	return undefined;
};
