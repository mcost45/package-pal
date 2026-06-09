import {
	dirname, resolve,
} from 'path';
import type { Logger } from '@package-pal/core';
import {
	normalisePath, formatUnknownError,
} from '@package-pal/util';

export const parseSln = async (solutionPaths: string[],
	logger?: Logger): Promise<string[]> => {
	const projectPaths = new Set<string>();

	for (const slnPath of solutionPaths) {
		try {
			const slnDir = dirname(slnPath);
			const file = Bun.file(slnPath);
			const text = await file.text();

			// Match Project("...") = "Name", "RelativePath.csproj", "..."
			const projectReg = /Project\("[^"]+"\)\s*=\s*"[^"]+",\s*"([^"]+\.[a-zA-Z]+proj)"/gi;
			let match;
			while ((match = projectReg.exec(text)) !== null) {
				const relativePath = match[1];
				if (relativePath) {
					const resolvedPath = normalisePath(resolve(slnDir, relativePath));
					projectPaths.add(resolvedPath);
				}
			}
		} catch (e: unknown) {
			logger?.debug(`Failed to read solution file '${slnPath}' - ${formatUnknownError(e)}.`);
		}
	}

	return Array.from(projectPaths);
};
