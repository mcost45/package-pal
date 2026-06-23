import { stat } from 'fs/promises';
import { runAsync } from '@package-pal/util';

const fileStatConcurrency = 20;

export const filterFilesModifiedSince = async (paths: string[], sinceMs: number): Promise<string[]> => {
	const tasks = paths.map(path => async () => {
		try {
			const s = await stat(path);
			const isModifiedSince = s.mtimeMs >= sinceMs;
			return isModifiedSince ? path : null;
		} catch {
			// File does not exist (deleted)
			return path;
		}
	});

	const results = await runAsync(tasks, fileStatConcurrency);
	return results.filter((path): path is string => path !== null);
};
