import { dirname } from 'path';

export const isRootDir = (path: string) => {
	return dirname(path) === path;
};
