import type { Logger } from '@package-pal/core';

export const DependenciesField = {
	Dependencies: 'dependencies',
	DevDependencies: 'devDependencies',
	PeerDependencies: 'peerDependencies',
	OptionalDependencies: 'optionalDependencies',
} as const;

export type DependenciesField = typeof DependenciesField[keyof typeof DependenciesField];

const PREFIX_REGEX = /^([~^><=]*)/;

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
	if (field === 'version' && packageName === updatePackageName) {
		const versionKey = `"version"`;
		const keyIndex = raw.indexOf(versionKey);
		if (keyIndex === -1) {
			return raw;
		}

		const versionStart = raw.indexOf('"', keyIndex + versionKey.length);
		const versionEnd = raw.indexOf('"', versionStart + 1);
		if (versionStart === -1 || versionEnd === -1) {
			return raw;
		}

		const currentVersionString = raw.slice(versionStart + 1, versionEnd);
		const updatedVersion = newVersion;
		logger?.info(`Updating '${updatePackageName}' version: ${currentVersionString} → ${updatedVersion}.`);
		const before = raw.slice(0, versionStart + 1);
		const after = raw.slice(versionEnd);

		return `${before}${updatedVersion}${after}`;
	}

	const fieldIndex = raw.indexOf(`"${field}"`);
	if (fieldIndex === -1) {
		return raw;
	}

	const fieldStart = raw.indexOf('{', fieldIndex);
	if (fieldStart === -1) {
		return raw;
	}

	const fieldEnd = raw.indexOf('}', fieldStart);
	if (fieldEnd === -1) {
		return raw;
	}

	const fieldBlock = raw.slice(fieldStart, fieldEnd);
	const depKey = `"${packageName}"`;
	const depIndex = fieldBlock.indexOf(depKey);
	if (depIndex === -1) {
		return raw;
	}

	const versionStart = fieldBlock.indexOf('"', depIndex + depKey.length);
	const versionEnd = fieldBlock.indexOf('"', versionStart + 1);
	if (versionStart === -1 || versionEnd === -1) {
		return raw;
	}

	const currentVersionString = fieldBlock.slice(versionStart + 1, versionEnd);
	const preservedPrefix = exact ? '' : (PREFIX_REGEX.exec(currentVersionString)?.[1] ?? '');
	const updatedVersion = `${preservedPrefix}${newVersion}`;
	logger?.info(`Updating '${updatePackageName}' ${field} '${packageName}': ${currentVersionString} → ${updatedVersion}.`);
	const before = raw.slice(0, fieldStart + versionStart + 1);
	const after = raw.slice(fieldStart + versionEnd);

	return `${before}${updatedVersion}${after}`;
};
