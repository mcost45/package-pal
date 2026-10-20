import type { Logger } from '@package-pal/core';
import {
	attribute, editXml, elementText, elements, walkElements,
} from './xml.ts';

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
	let currentVersion = '';
	let modified = false;
	const updatedRaw = editXml(dependentRaw, (root) => {
		for (const node of walkElements(root)) {
			if (!['packagereference', 'packageversion'].includes(node.name.toLowerCase())) continue;
			if (attribute(node, 'Include') !== packageName && attribute(node, 'Update') !== packageName) continue;
			const versionKey = Object.keys(node.attributes).find(key => key.toLowerCase() === 'version');
			const versionChild = elements(node).find(child => child.name.toLowerCase() === 'version');
			const version = versionKey ? node.attributes[versionKey] : elementText(versionChild);
			if (!version) continue;
			currentVersion = version;
			if (!isWritableVersion(version)) {
				logger?.debug(`Ignored bump of package '${packageName}' in '${dependentName ?? ''}' because current version '${version}' is not a writable SemVer form.`);
				continue;
			}
			const nextVersion = getUpdatedVersion(
				version, bumpedVersion, exact,
			);
			if (nextVersion === version) continue;
			if (versionKey) node.attributes[versionKey] = nextVersion;
			else if (versionChild) versionChild.children = [nextVersion];
			modified = true;
			logger?.info(`Updating '${dependentName ?? 'MyProject'}' ${node.name} '${packageName}': ${version} → ${nextVersion}.`);
		}
		return modified;
	});
	return updatedRaw !== dependentRaw
		? {
				updatedRaw,
				currentVersion,
			}
		: undefined;
};
