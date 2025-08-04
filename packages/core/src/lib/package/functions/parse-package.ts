import {
	dirname, basename,
} from 'path';
import { isDefined } from '@package-pal/util';
import type { PackageData } from '../types/package-data.ts';

export const parsePackage = (path: string, text: string): PackageData | undefined => {
	const base: unknown = JSON.parse(text);

	if (!isDefined(base) || typeof base !== 'object') {
		return;
	}

	const props = base as Partial<PackageData>;
	const {
		dependencies, peerDependencies, devDependencies,
	} = props;

	if ((isDefined(dependencies) && !(typeof dependencies === 'object'))
		|| (isDefined(peerDependencies) && !(typeof peerDependencies === 'object'))
		|| (isDefined(devDependencies) && !(typeof devDependencies === 'object'))) {
		return;
	}

	return {
		rawContent: text,
		path,
		name: props.name ?? path,
		dir: basename(dirname(path)),
		version: props.version ?? undefined,
		dependencies: dependencies ?? undefined,
		peerDependencies: peerDependencies ?? undefined,
		devDependencies: devDependencies ?? undefined,
	};
};
