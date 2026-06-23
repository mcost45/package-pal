import { Glob } from 'bun';

/**
 * Parses and filters ignore patterns, returning an array of pre-compiled Glob objects,
 * or undefined if no valid patterns were provided.
 */
export const getIgnoreGlobs = (ignore: string | string[]): Glob[] | undefined => {
	const patterns = Array.isArray(ignore) ? ignore : [ignore];
	const filtered = patterns.filter(pattern => pattern.length > 0);
	return filtered.length === 0 ? undefined : filtered.map(pattern => new Glob(pattern));
};
