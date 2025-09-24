import { semver } from 'bun';
import { inc } from 'semver';
import { dim } from 'yoctocolors';
import type { Logger } from '../../configuration/types/logger.ts';
import { dfsTraverseGraph } from '../../graph/functions/dfs-traverse-graph.ts';
import type { PackageGraphs } from '../../graph/types/package-graphs.ts';
import type { BumpVersionType } from '../../types/bump-version-type.ts';
import { DependenciesField } from '../types/dependencies-field.ts';

const findAndReplaceVersion = ({
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
	exact: boolean;
	logger: Logger;
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
		logger.info(`Updating '${updatePackageName}' version: ${currentVersionString} → ${updatedVersion}.`);
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
	const preservedPrefix = exact ? '' : (/^([~^><=]*)/.exec(currentVersionString)?.[1] ?? '');
	const updatedVersion = `${preservedPrefix}${newVersion}`;
	logger.info(`Updating '${updatePackageName}' ${field} '${packageName}': ${currentVersionString} → ${updatedVersion}.`);
	const before = raw.slice(0, fieldStart + versionStart + 1);
	const after = raw.slice(fieldStart + versionEnd);

	return `${before}${updatedVersion}${after}`;
};

export const updatePackageVersion = async (
	packageName: string,
	type: BumpVersionType,
	packageGraphs: PackageGraphs,
	preId: string | undefined,
	exact: boolean,
	logger: Logger,
): Promise<void> => {
	logger.debug(dim(`Bumping package '${packageName}'...`));
	const packageNode = packageGraphs.dependencies.get(packageName);
	if (!packageNode) {
		throw new Error(`Package '${packageName}' not found.`);
	}

	const currentVersion = packageNode.packageData.version;
	if (!currentVersion) {
		throw new Error(`Package '${packageName}' has no version.`);
	}

	const bumpedVersion = inc(
		currentVersion, type, undefined, preId,
	);
	if (!bumpedVersion) {
		throw new Error(`Package '${packageName}' version '${currentVersion}' is invalid.`);
	}

	const updatedContent = findAndReplaceVersion({
		raw: packageNode.packageData.rawContent,
		field: 'version',
		packageName,
		updatePackageName: packageName,
		newVersion: bumpedVersion,
		exact,
		logger,
	});

	const baseWrite = Bun.write(packageNode.packageData.path, updatedContent);
	const dependentWrites = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName).flatMap((dependent) => {
		return Object.values(DependenciesField).flatMap((field) => {
			const entry = dependent[field];
			const depVersion = entry?.[packageName];
			if (!depVersion) {
				return [];
			}

			if (exact ? depVersion === bumpedVersion : semver.satisfies(bumpedVersion, depVersion)) {
				logger.debug(dim(`Skipping '${dependent.name}': ${field} version '${depVersion}' already satisfies '${bumpedVersion}'.`));
				return [];
			}

			const updatedContent = findAndReplaceVersion({
				raw: dependent.rawContent,
				field,
				packageName,
				updatePackageName: dependent.name,
				newVersion: bumpedVersion,
				exact,
				logger,
			});

			return [Bun.write(dependent.path, updatedContent)];
		});
	}));

	return Promise.all([baseWrite, ...dependentWrites]).then(() => undefined);
};
