/**
 * Normalizes all directory separators in a path to forward slashes for cross-platform consistency.
 */
export const normalisePath = (path: string): string => {
	return path.replace(/\\/g, '/');
};
