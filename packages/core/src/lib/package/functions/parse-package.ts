import {
	dirname, basename,
} from 'path';
import { isDefined } from '@package-pal/util';
import { DependenciesField } from '../types/dependencies-field.ts';
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

	for (const field of Object.values(DependenciesField)) {
		const value = props[field];
		if (isDefined(value) && typeof value !== 'object') {
			return;
		}
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
