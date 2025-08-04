export const filterFilesModifiedSince = (paths: string[], sinceMs: number) => {
	return paths.filter((path) => {
		const changedFile = Bun.file(path);
		return changedFile.lastModified >= sinceMs;
	});
};
