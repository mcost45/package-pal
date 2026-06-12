import { readFileSync } from 'fs';
import {
	dirname, basename, resolve, extname,
} from 'path';
import type { PackageData } from '@package-pal/core';
import { normalisePath } from '@package-pal/util';
import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { PackageVersionSourceType } from '../types/package-version-source-type.ts';
import { collectPropertiesFromDom } from './collect-properties.ts';
import { findCpmFile } from './find-cpm-file.ts';
import { collectNodesByTags } from './find-nodes.ts';
import { getElementTextFromNode } from './get-element-text.ts';
import { resolveMsbuildName } from './resolve-msbuild-name.ts';

const msbuildTags = new Set([
	'PackageId',
	'AssemblyName',
	'Version',
	'VersionPrefix',
	'ProjectReference',
	'PackageReference',
]);

export const parseMsbuild = (
	path: string,
	text: string,
	dom: (TNode | string)[],
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
	cpmCache?: Map<string, {
		raw: string;
		dom: (TNode | string)[];
		packageVersionNodes: TNode[];
	} | null>,
): PackageData | undefined => {
	const collected = collectNodesByTags(dom, msbuildTags);

	// Collect local properties defined in this project file
	if (propertyMap) {
		collectPropertiesFromDom(
			dom, normalisePath(path), propertyMap,
		);
	}

	const name = resolveMsbuildName(
		path, dom, collected,
	);
	const rawVersion = getElementTextFromNode(collected.Version?.[0]) ?? getElementTextFromNode(collected.VersionPrefix?.[0]);

	let version = rawVersion ?? '1.0.0';
	let resolvedVersion = false;

	if (rawVersion) {
		const propMatch = /^\$\(([^)]+)\)$/.exec(rawVersion.trim());
		if (propMatch?.[1]) {
			const propName = propMatch[1];
			const resolvedProp = propertyMap?.get(propName.toLowerCase());
			if (resolvedProp) {
				version = resolvedProp.value;
				resolvedVersion = true;
				if (packageVersionProperties) {
					packageVersionProperties.set(normalisePath(path), {
						type: PackageVersionSourceType.Property,
						name: propName,
						filePath: resolvedProp.filePath,
					});
				}
			}
		} else {
			resolvedVersion = true;
		}
	}

	// Case: No local version defined inside the project file.
	// Walk up to look up version centrally in Directory.Packages.props (CPM).
	if (!resolvedVersion) {
		const cpmPath = findCpmFile(path);
		if (cpmPath) {
			try {
				let cached = cpmCache?.get(cpmPath);
				if (cached === undefined) {
					try {
						const cpmRaw = readFileSync(cpmPath, 'utf8');
						const cpmDom = parse(cpmRaw);
						const packageVersionNodes = collectNodesByTags(cpmDom, new Set(['PackageVersion'])).PackageVersion ?? [];
						cached = {
							raw: cpmRaw,
							dom: cpmDom,
							packageVersionNodes,
						};
					} catch {
						cached = null;
					}
					if (cpmCache) {
						cpmCache.set(cpmPath, cached);
					}
				}

				if (cached) {
					const { packageVersionNodes } = cached;
					for (const node of packageVersionNodes) {
						let includeVal: string | undefined;
						let versionAttr: string | undefined;

						for (const key in node.attributes) {
							const lowerKey = key.toLowerCase();
							if (lowerKey === 'include') {
								includeVal = node.attributes[key] ?? undefined;
							} else if (lowerKey === 'version') {
								versionAttr = node.attributes[key] ?? undefined;
							}
						}

						if (includeVal === name) {
							const versionChild = node.children.find((child): child is TNode => !!child && typeof child === 'object' && child.tagName.toLowerCase() === 'version');
							const cpmVersionVal = versionAttr ?? getElementTextFromNode(versionChild);

							if (cpmVersionVal) {
								let cleanedVersion = cpmVersionVal.trim();
								// Strip exact pin brackets, e.g. [6.0.0] -> 6.0.0
								if (cleanedVersion.startsWith('[') && cleanedVersion.endsWith(']')) {
									cleanedVersion = cleanedVersion.slice(1, -1).trim();
								}

								const propMatch = /^\$\(([^)]+)\)$/.exec(cleanedVersion);
								if (propMatch?.[1]) {
									const propName = propMatch[1];
									const resolvedProp = propertyMap?.get(propName.toLowerCase());
									if (resolvedProp) {
										version = resolvedProp.value;
										if (packageVersionProperties) {
											packageVersionProperties.set(normalisePath(path), {
												type: PackageVersionSourceType.Property,
												name: propName,
												filePath: resolvedProp.filePath,
											});
										}
									} else {
										version = cleanedVersion;
									}
								} else {
									version = cleanedVersion;
									if (packageVersionProperties) {
										packageVersionProperties.set(normalisePath(path), {
											type: PackageVersionSourceType.CpmLiteral,
											name,
											filePath: normalisePath(cpmPath),
										});
									}
								}
								break;
							}
						}
					}
				}
			} catch {
				// Ignore read errors and keep default
			}
		}
	}

	const localDependencies: string[] = [];
	const projectRefs = collected.ProjectReference ?? [];

	for (const ref of projectRefs) {
		const includePath = ref.attributes.Include;
		if (includePath) {
			const normalizedInclude = normalisePath(includePath);
			const absoluteRefPath = normalisePath(resolve(dirname(path), normalizedInclude));
			const depName = pathToName.get(absoluteRefPath) ?? basename(absoluteRefPath, extname(absoluteRefPath));
			if (depName) {
				localDependencies.push(depName);
			}
		}
	}

	const packageRefs = collected.PackageReference ?? [];
	for (const ref of packageRefs) {
		const includeName = ref.attributes.Include ?? ref.attributes.Update;
		if (includeName) {
			localDependencies.push(includeName);
		}
	}

	return {
		rawContent: text,
		name,
		path,
		dir: basename(dirname(path)),
		version,
		localDependencies,
	};
};
