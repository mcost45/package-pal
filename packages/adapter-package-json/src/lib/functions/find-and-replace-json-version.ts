import type { Logger } from '@package-pal/core';
import type { ValueOf } from '@package-pal/util';
import { parseTree } from 'jsonc-parser';

export const DependenciesField = {
	Dependencies: 'dependencies',
	DevDependencies: 'devDependencies',
	PeerDependencies: 'peerDependencies',
	OptionalDependencies: 'optionalDependencies',
} as const;

export type DependenciesField = ValueOf<typeof DependenciesField>;

interface Replacement {
	start: number;
	end: number;
	currentValue: string;
	field: 'version' | DependenciesField;
}

export const findAndReplaceJsonVersion = ({
	raw,
	field,
	packageName,
	updatePackageName,
	newVersion,
	exact,
	logger,
}: {
	raw: string;
	field: 'version' | DependenciesField;
	packageName: string;
	updatePackageName: string;
	newVersion: string;
	exact: boolean | undefined;
	logger?: Logger | undefined;
}): string => {
	const parserRaw = raw.replace(/'/g, '"');
	const root = parseTree(parserRaw);
	if (root?.type !== 'object') {
		return raw;
	}

	const replacements: Replacement[] = [];

	if (field === 'version') {
		if (packageName === updatePackageName) {
			const versionProp = root.children?.find(child => child.type === 'property' && child.children?.[0]?.value === 'version');
			const valNode = versionProp?.children?.[1];
			if (valNode?.type === 'string') {
				replacements.push({
					start: valNode.offset,
					end: valNode.offset + valNode.length,
					currentValue: valNode.value as string,
					field: 'version',
				});
			}
		}
	} else {
		const depsProp = root.children?.find(child => child.type === 'property' && child.children?.[0]?.value === field);
		const depsObjNode = depsProp?.children?.[1];
		if (depsObjNode?.type === 'object') {
			const depProp = depsObjNode.children?.find(child => child.type === 'property' && child.children?.[0]?.value === packageName);
			const valNode = depProp?.children?.[1];
			if (valNode?.type === 'string') {
				replacements.push({
					start: valNode.offset,
					end: valNode.offset + valNode.length,
					currentValue: valNode.value as string,
					field: field,
				});
			}
		}
	}

	if (replacements.length === 0) {
		return raw;
	}

	let result = raw;
	replacements.sort((a, b) => b.start - a.start);

	for (const rep of replacements) {
		const currentVersionString = rep.currentValue;
		let updatedVersion: string;

		if (exact) {
			updatedVersion = newVersion;
		} else {
			const match = /(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)$/.exec(currentVersionString);
			if (match) {
				const matchedVersion = match[1];
				const prefix = matchedVersion
					? currentVersionString.slice(0, -matchedVersion.length)
					: '';
				updatedVersion = `${prefix}${newVersion}`;
			} else {
				if (currentVersionString.startsWith('workspace:^')) {
					updatedVersion = `workspace:^${newVersion}`;
				} else if (currentVersionString.startsWith('workspace:~')) {
					updatedVersion = `workspace:~${newVersion}`;
				} else if (currentVersionString.startsWith('workspace:')) {
					updatedVersion = `workspace:^${newVersion}`;
				} else if (currentVersionString.startsWith('^')) {
					updatedVersion = `^${newVersion}`;
				} else if (currentVersionString.startsWith('~')) {
					updatedVersion = `~${newVersion}`;
				} else {
					updatedVersion = `^${newVersion}`;
				}
			}
		}

		logger?.info(`Updating '${updatePackageName}' ${rep.field}${rep.field === 'version' ? '' : ` '${packageName}'`}: ${currentVersionString} → ${updatedVersion}.`);

		const before = result.slice(0, rep.start + 1);
		const after = result.slice(rep.end - 1);
		result = `${before}${updatedVersion}${after}`;
	}

	return result;
};
