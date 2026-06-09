import type { Logger } from '@package-pal/core';
import {
	normalisePath, formatUnknownError,
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
	const fileEntries: ProjectFileEntry[] = [];

	for (const manifestPath of projectPaths) {
		try {
			logger?.debug(`Reading MSBuild project in '${manifestPath}'.`);
			const file = Bun.file(manifestPath);

			if (!file.size) {
				logger?.debug(`Failed to read project manifest in '${manifestPath}' - File empty or not found.`);
				continue;
			}

			const text = await file.text();
			const dom = parse(text);
			const name = resolveMsbuildName(manifestPath, dom);

			if (name) {
				pathToName.set(normalisePath(manifestPath), name);
				fileEntries.push({
					path: manifestPath,
					text,
					dom,
				});
			}
		} catch (e: unknown) {
			logger?.debug(`Failed to read project in '${manifestPath}' - ${formatUnknownError(e)}.`);
		}
	}

	return fileEntries;
};
