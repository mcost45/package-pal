import { readdir } from 'fs/promises';
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
	directoryPropertyFilesCache: Map<string, Promise<string[]>>,
	propertyFileCache: Map<string, Promise<Map<string, string>>>,
) => {
	let currentDir = dirname(resolve(projectPath));
	let previousDir = '';

	while (currentDir !== previousDir) {
		try {
			let filesPromise = directoryPropertyFilesCache.get(currentDir);
			if (!filesPromise) {
				filesPromise = (async () => {
					const allFiles = await readdir(currentDir);
					const files: string[] = [];
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
					return files;
				})();
				directoryPropertyFilesCache.set(currentDir, filesPromise);
			}

			const files = await filesPromise;

			for (const fullPath of files) {
				const normalizedPath = normalisePath(fullPath);
				let filePropsPromise = propertyFileCache.get(normalizedPath);

				if (!filePropsPromise) {
					filePropsPromise = (async () => {
						const fileProps = new Map<string, string>();
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
						return fileProps;
					})();
					propertyFileCache.set(normalizedPath, filePropsPromise);
				}

				const fileProps = await filePropsPromise;

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
