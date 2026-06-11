import {
	dirname, basename,
} from 'path';
import type { PackageData } from '@package-pal/core';
import { isDefined } from '@package-pal/util';
import type { DependenciesField } from './find-and-replace-json-version.ts';

const dependencyFields: DependenciesField[] = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
];

export const parsePackageJson = (path: string, text: string): PackageData | undefined => {
	const base: unknown = JSON.parse(text);

	if (!isDefined(base) || typeof base !== 'object') {
		return;
	}

	const props = base as Partial<PackageData>;
	const {
		dependencies, peerDependencies, devDependencies, optionalDependencies,
	} = props;

	for (const field of dependencyFields) {
		const value = props[field];
		if (isDefined(value) && typeof value !== 'object') {
			return;
		}
	}

	// Collect all declared dependencies into a flat localDependencies array for core graph building
	const localDependencies: string[] = [];
	for (const field of dependencyFields) {
		const fieldObj = props[field];
		if (isDefined(fieldObj) && typeof fieldObj === 'object') {
			for (const depName of Object.keys(fieldObj)) {
				localDependencies.push(depName);
			}
		}
	}

	return {
		rawContent: text,
		path,
		name: props.name ?? path,
		dir: basename(dirname(path)),
		version: props.version ?? undefined,
		localDependencies,
		dependencies: dependencies ?? undefined,
		peerDependencies: peerDependencies ?? undefined,
		devDependencies: devDependencies ?? undefined,
		optionalDependencies: optionalDependencies ?? undefined,
	};
};
