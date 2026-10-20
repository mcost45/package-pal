import { readFileSync } from 'fs';
import {
	dirname, basename, resolve, extname,
} from 'path';
import type { PackageData } from '@package-pal/core';
import { normalisePath } from '@package-pal/util';
import type { XML } from 'bun';
import { PackageVersionSourceType } from '../types/package-version-source-type.ts';
import { collectPropertiesFromDom } from './collect-properties.ts';
import { findCpmFile } from './find-cpm-file.ts';
import { resolveMsbuildName } from './resolve-msbuild-name.ts';
import {
	attribute, parseProject, elementText, elements, properties, walkElements,
} from './xml.ts';

const resolveProjectReferenceName = (projectPath: string, pathToName: Map<string, string>): string => {
	const path = normalisePath(projectPath);
	const cached = pathToName.get(path);
	if (cached) return cached;
	try {
		const root = parseProject(readFileSync(projectPath));
		const name = resolveMsbuildName(projectPath, root);
		pathToName.set(path, name);
		return name;
	} catch {
		return basename(path, extname(path));
	}
};

export const parseMsbuild = (
	path: string,
	text: string,
	root: XML.Node,
	pathToName: Map<string, string>,
	propertyMap?: Map<string, {
		value: string;
		filePath: string;
	}>,
	packageVersionProperties?: Map<string, {
		type: PackageVersionSourceType;
		name: string;
		filePath: string;
	}>,
	cpmCache?: Map<string, Map<string, string>>,
	cpmPathCache?: Map<string, string | null>,
): PackageData => {
	if (propertyMap) collectPropertiesFromDom(
		root, normalisePath(path), propertyMap,
	);
	const name = resolveMsbuildName(path, root);
	const values = properties(root);
	let version = elementText(values.find(node => node.name.toLowerCase() === 'version'))
		?? elementText(values.find(node => node.name.toLowerCase() === 'versionprefix'));
	let versionFile = path;
	let isCpmVersion = false;

	if (!version) {
		const cpmPath = findCpmFile(path, cpmPathCache);
		if (cpmPath) {
			let versions = cpmCache?.get(cpmPath);
			if (!versions) {
				const cpmRoot = parseProject(readFileSync(cpmPath));
				versions = new Map<string, string>();
				for (const node of walkElements(cpmRoot)) {
					if (node.name.toLowerCase() !== 'packageversion') continue;
					const packageName = attribute(node, 'Include') ?? attribute(node, 'Update');
					const value = attribute(node, 'Version') ?? elementText(elements(node).find(child => child.name.toLowerCase() === 'version'));
					if (packageName && value && !versions.has(packageName)) versions.set(packageName, value);
				}
				cpmCache?.set(cpmPath, versions);
			}
			version = versions.get(name);
			if (version) {
				version = version.trim().replace(/^\[([^,\]]+)\]$/, '$1');
				versionFile = cpmPath;
				isCpmVersion = true;
			}
		}
	}

	const propertyName = version ? /^\$\(([^)]+)\)$/.exec(version)?.[1] : undefined;
	const property = propertyName ? propertyMap?.get(propertyName.toLowerCase()) : undefined;
	if (property && propertyName) {
		version = property.value;
		packageVersionProperties?.set(normalisePath(path), {
			type: PackageVersionSourceType.Property,
			name: propertyName,
			filePath: property.filePath,
		});
	} else if (isCpmVersion) {
		packageVersionProperties?.set(normalisePath(path), {
			type: PackageVersionSourceType.CpmLiteral,
			name,
			filePath: normalisePath(versionFile),
		});
	}

	const localDependencies: string[] = [];
	for (const node of walkElements(root)) {
		if (node.name.toLowerCase() === 'projectreference') {
			const include = attribute(node, 'Include');
			if (include) localDependencies.push(resolveProjectReferenceName(normalisePath(resolve(dirname(path), normalisePath(include))), pathToName));
		} else if (node.name.toLowerCase() === 'packagereference') {
			const include = attribute(node, 'Include') ?? attribute(node, 'Update');
			if (include) localDependencies.push(include);
		}
	}

	return {
		rawContent: text,
		name,
		path,
		dir: basename(dirname(path)),
		version: version ?? '1.0.0',
		localDependencies,
	};
};
