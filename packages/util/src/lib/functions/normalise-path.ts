/**
 * Normalizes all directory separators in a path to forward slashes for cross-platform consistency.
 */
export const normalisePath = (path: string): string => {
	if (path.includes('\\')) {
		return path.replace(/\\/g, '/');
	}
	return path;
};
