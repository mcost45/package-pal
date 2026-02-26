export const filterFilesModifiedSince = (paths: string[], sinceMs: number) => {
	return paths.filter((path) => {
		const changedFile = Bun.file(path);
		const isDeleted = changedFile.lastModified === 0;
		const isModifiedSince = changedFile.lastModified >= sinceMs;

		return isDeleted || isModifiedSince;
	});
};
