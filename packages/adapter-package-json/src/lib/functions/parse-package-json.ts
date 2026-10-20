import {
	basename, dirname,
} from 'path';
import type { PackageData } from '@package-pal/core';

export const dependencyFields = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
] as const;

type DependencyField = typeof dependencyFields[number];
export type PackageManifest = Record<string, unknown> & Partial<Pick<PackageData, 'name' | 'version' | DependencyField>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const parsePackageManifest = (text: string): PackageManifest => {
	const value = Bun.JSONC.parse(text);
	if (!isRecord(value)
		|| (value.name !== undefined && typeof value.name !== 'string')
		|| (value.version !== undefined && typeof value.version !== 'string')
		|| dependencyFields.some(field => value[field] !== undefined
			&& (!isRecord(value[field]) || Object.values(value[field]).some(version => typeof version !== 'string')))) {
		throw new TypeError('Expected a package manifest with string name, version and dependency ranges.');
	}
	return value;
};

export const packageDataFromManifest = (
	path: string, text: string, props: PackageManifest,
): PackageData => ({
	rawContent: text,
	path,
	name: props.name ?? path,
	dir: basename(dirname(path)),
	version: props.version,
	localDependencies: [...new Set(dependencyFields.flatMap(field => Object.keys(props[field] ?? {})))],
	dependencies: props.dependencies,
	peerDependencies: props.peerDependencies,
	devDependencies: props.devDependencies,
	optionalDependencies: props.optionalDependencies,
});

export const serializePackageJson = (manifest: PackageManifest, original: string): string => {
	const indent = /^[\t ]+(?=")/m.exec(original)?.[0] ?? '  ';
	const newline = original.includes('\r\n') ? '\r\n' : '\n';
	const text = JSON.stringify(
		manifest, null, indent,
	).replaceAll('\n', newline);
	return text + (original.endsWith('\n') ? newline : '');
};
