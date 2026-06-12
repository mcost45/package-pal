import type { Logger } from '@package-pal/core';
import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { escapeXml } from './escape-xml.ts';
import {
	stringifyMsbuild, detectSelfClosingSpace,
} from './stringify-msbuild.ts';

const isWritableVersion = (v: string): boolean => {
	const s = v.trim();

	if (!s) return false;

	// If it is a clean MSBuild property expression, it is writable!
	if (/^\$\([a-zA-Z0-9_.-]+\)$/.test(s)) {
		return true;
	}

	// If it is a bracketed single version, it is writable!
	if (/^\[\d+(\.\d+){1,2}([-+][a-zA-Z0-9.-]+)?\]$/.test(s)) {
		return true;
	}

	// explicitly non-writable MSBuild constructs
	if (
		s.includes('$') // MSBuild property
		|| s.includes('*') // wildcards
		|| s.includes('[') // version ranges
		|| s.includes(']')
		|| s.includes(',')
		|| s.includes('|')
	) return false;

	// allow only simple semver-ish OR prefixed forms
	return /^[~^]?\d+(\.\d+){1,2}([-+][a-zA-Z0-9.-]+)?$/.test(s)
		|| /^workspace:/i.test(s);
};

const getUpdatedVersion = (
	currentVersion: string,
	bumpedVersion: string,
	exact: boolean,
): string => {
	if (/^\$\([a-zA-Z0-9_.-]+\)$/.test(currentVersion.trim())) {
		return currentVersion;
	}

	const trimmed = currentVersion.trim();
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		return `[${bumpedVersion}]`;
	}

	if (exact) {
		return bumpedVersion;
	}

	const match = /(\d+(?:\.\d+){0,2}(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)$/.exec(currentVersion);
	if (match?.[1]) {
		const matchedVersion = match[1];
		const prefix = currentVersion.slice(0, -matchedVersion.length);
		return `${prefix}${bumpedVersion}`;
	}

	return bumpedVersion;
};

export const bumpMsbuildReferenceVersion = (
	dependentRaw: string,
	packageName: string,
	bumpedVersion: string,
	exact = false,
	logger?: Logger,
	dependentName?: string,
): {
	updatedRaw: string;
	currentVersion: string;
} | undefined => {
	const dom = parse(dependentRaw, {
		keepComments: true,
		keepWhitespace: true,
	});

	const tags = new Set(['PackageReference', 'PackageVersion']);
	const context = { modified: false };
	let foundVersion: string | undefined;

	const update = (nodes: (TNode | string)[]) => {
		for (const node of nodes) {
			if (node && typeof node === 'object') {
				if (tags.has(node.tagName)) {
					let includeVal: string | undefined;
					let updateVal: string | undefined;
					let versionAttr: string | undefined;
					let versionAttrKey: string | undefined;

					for (const key in node.attributes) {
						const lowerKey = key.toLowerCase();
						if (lowerKey === 'include') {
							includeVal = node.attributes[key] ?? undefined;
						} else if (lowerKey === 'update') {
							updateVal = node.attributes[key] ?? undefined;
						} else if (lowerKey === 'version') {
							versionAttr = node.attributes[key] ?? undefined;
							versionAttrKey = key;
						}
					}

					if (includeVal === packageName || updateVal === packageName) {
						if (versionAttr) {
							foundVersion = versionAttr;
							if (isWritableVersion(versionAttr)) {
								const updatedVersion = getUpdatedVersion(
									versionAttr, bumpedVersion, exact,
								);
								if (updatedVersion !== versionAttr) {
									if (versionAttrKey) {
										node.attributes[versionAttrKey] = updatedVersion;
									}
									context.modified = true;
									logger?.info(`Updating '${dependentName ?? 'MyProject'}' ${node.tagName} '${packageName}': ${versionAttr} → ${updatedVersion}.`);
								}
							} else {
								logger?.debug(`Ignored bump of package '${packageName}' in '${dependentName ?? ''}' because current version '${versionAttr}' is not a writable SemVer form.`);
							}
						} else {
							const versionChildIndex = node.children.findIndex((child): child is TNode => !!child && typeof child === 'object' && child.tagName.toLowerCase() === 'version');
							if (versionChildIndex !== -1) {
								const child = node.children[versionChildIndex];
								if (child && typeof child === 'object') {
									const childText = getElementTextFromNode(child);
									if (childText) {
										foundVersion = childText;
										if (isWritableVersion(childText)) {
											const updatedVersion = getUpdatedVersion(
												childText, bumpedVersion, exact,
											);
											if (updatedVersion !== childText) {
												child.children = [escapeXml(updatedVersion)];
												context.modified = true;
												logger?.info(`Updating '${dependentName ?? 'MyProject'}' ${node.tagName} '${packageName}': ${childText} → ${updatedVersion}.`);
											}
										} else {
											logger?.debug(`Ignored bump of package '${packageName}' in '${dependentName ?? ''}' because current child version '${childText}' is not a writable SemVer form.`);
										}
									}
								}
							}
						}
					}
				}
				update(node.children);
			}
		}
	};

	update(dom);

	if (context.modified) {
		const selfClosingSpace = detectSelfClosingSpace(dependentRaw);
		const updatedRaw = stringifyMsbuild(dom, { selfClosingSpace });
		return {
			updatedRaw,
			currentVersion: foundVersion ?? '',
		};
	}

	return undefined;
};

const getElementTextFromNode = (node: TNode | string | undefined): string | undefined => {
	if (!node) return undefined;
	if (typeof node === 'string') return node;
	return node.children.map((child) => {
		if (typeof child === 'string') return child;
		return getElementTextFromNode(child);
	}).join('');
};
