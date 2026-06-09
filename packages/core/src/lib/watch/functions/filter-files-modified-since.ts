import { stat } from 'fs/promises';

export const filterFilesModifiedSince = async (paths: string[], sinceMs: number): Promise<string[]> => {
	const results = await Promise.all(paths.map(async (path) => {
		try {
			const s = await stat(path);
			const isModifiedSince = s.mtimeMs >= sinceMs;
			return isModifiedSince ? path : null;
		} catch {
			// File does not exist (deleted)
			return path;
		}
	}));
	return results.filter((path): path is string => path !== null);
};
