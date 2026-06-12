import { readdirSync } from 'fs';
import {
	dirname, join, resolve,
} from 'path';
import { normalisePath } from '@package-pal/util';
import { parse } from 'txml/txml';
import { collectPropertiesFromDom } from './collect-properties.ts';

export const findAndParsePropertyFilesUpward = async (
	projectPath: string,
	propertyMap: Map<string, {
		value: string;
		filePath: string;
	}>,
	directoryPropertyFilesCache: Map<string, string[]>,
	propertyFileCache: Map<string, Map<string, string>>,
) => {
	let currentDir = dirname(resolve(projectPath));
	let previousDir = '';

	while (currentDir !== previousDir) {
		try {
			let files = directoryPropertyFilesCache.get(currentDir);
			if (!files) {
				const allFiles = readdirSync(currentDir);
				files = [];
				for (const file of allFiles) {
					const lower = file.toLowerCase();
					if (
						lower === 'directory.build.props'
						|| lower === 'directory.packages.props'
						|| lower.endsWith('.props')
						|| lower.endsWith('.targets')
					) {
						files.push(join(currentDir, file));
					}
				}
				directoryPropertyFilesCache.set(currentDir, files);
			}

			for (const fullPath of files) {
				const normalizedPath = normalisePath(fullPath);
				let fileProps = propertyFileCache.get(normalizedPath);

				if (!fileProps) {
					fileProps = new Map<string, string>();
					const fileObj = Bun.file(fullPath);
					if (await fileObj.exists()) {
						const text = await fileObj.text();
						const dom = parse(text);
						const tempMap = new Map<string, {
							value: string;
							filePath: string;
						}>();
						collectPropertiesFromDom(
							dom, normalizedPath, tempMap,
						);
						for (const [key, prop] of tempMap) {
							fileProps.set(key, prop.value);
						}
					}
					propertyFileCache.set(normalizedPath, fileProps);
				}

				// Merge into project's propertyMap, but ONLY if not already present
				// (to respect inner-to-outer evaluation/precedence!)
				for (const [key, value] of fileProps) {
					if (!propertyMap.has(key)) {
						propertyMap.set(key, {
							value,
							filePath: normalizedPath,
						});
					}
				}
			}
		} catch {
			// Ignore directory read errors
		}
		previousDir = currentDir;
		currentDir = dirname(currentDir);
	}
};
