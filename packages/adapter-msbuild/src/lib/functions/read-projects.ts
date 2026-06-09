import type { Logger } from '@package-pal/core';
import {
	normalisePath, formatUnknownError, runAsync,
} from '@package-pal/util';
import type { TNode } from 'txml/txml';
import { parse } from 'txml/txml';
import { resolveMsbuildName } from './resolve-msbuild-name.ts';

export interface ProjectFileEntry {
	path: string;
	text: string;
	dom: (TNode | string)[];
}

export const readProjects = async (
	projectPaths: string[],
	pathToName: Map<string, string>,
	logger?: Logger,
): Promise<ProjectFileEntry[]> => {
	const tasks = projectPaths.map(manifestPath => async () => {
		try {
			logger?.debug(`Reading MSBuild project in '${manifestPath}'.`);
			const file = Bun.file(manifestPath);

			if (!file.size) {
				logger?.debug(`Failed to read project manifest in '${manifestPath}' - File empty or not found.`);
				return null;
			}

			const text = await file.text();
			const dom = parse(text);
			const name = resolveMsbuildName(manifestPath, dom);

			if (name) {
				return {
					path: manifestPath,
					text,
					dom,
					name,
				};
			}
		} catch (e: unknown) {
			logger?.debug(`Failed to read project in '${manifestPath}' - ${formatUnknownError(e)}.`);
		}
		return null;
	});

	const results = await runAsync(tasks);
	const fileEntries: ProjectFileEntry[] = [];

	for (const entry of results) {
		if (entry) {
			pathToName.set(normalisePath(entry.path), entry.name);
			fileEntries.push({
				path: entry.path,
				text: entry.text,
				dom: entry.dom,
			});
		}
	}

	return fileEntries;
};
