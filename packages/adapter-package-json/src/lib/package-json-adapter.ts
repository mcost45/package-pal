import {
	dirname, join,
} from 'path';
import { styleText } from 'util';
import type {
	Logger, PackageData, PackageGraphs, BumpVersionType,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths, dfsTraverseGraph,
} from '@package-pal/core';
import { formatUnknownError } from '@package-pal/util';
import { semver } from 'bun';
import { inc } from 'semver';
import {
	findAndReplaceJsonVersion, DependenciesField,
} from './functions/find-and-replace-json-version.ts';
import { parsePackageJson } from './functions/parse-package-json.ts';

export class PackageJsonAdapter extends PackageAdapter {
	readonly name = 'package-json' as const;
	readonly manifestPattern = 'package.json' as const;

	async* scanPackages(
		patterns: string[],
		logger?: Logger,
		cwd?: string,
	): AsyncIterable<PackageData> {
		for await (const path of scanPackagePaths(patterns, cwd)) {
			const packagePath = join(path, 'package.json');
			const dir = dirname(packagePath);

			try {
				logger?.debug(styleText('dim', `Trying to read read package.json in '${dir}'.`));
				const file = Bun.file(packagePath);

				// TODO-MC: Windows - file.text() kills the process for non-existent files...
				if (!file.size) {
					logger?.debug(styleText('dim', `Failed to read package.json in '${dir}' - ${styleText('red', 'File not found')}.`));
					continue;
				}

				const text = await file.text();
				const packageData = parsePackageJson(packagePath, text);

				if (!packageData) {
					logger?.debug(styleText('dim', `Invalid package.json found in '${dir}'.`));
					continue;
				}

				logger?.debug(styleText('dim', `Successfully read package.json in '${dir}'.`));
				yield packageData;
			} catch (e: unknown) {
				logger?.debug(styleText('dim', `Failed to read package.json in '${dir}' - ${styleText('red', formatUnknownError(e))}.`));
			}
		}
	}

	async updateVersion(options: {
		packageName: string;
		type: BumpVersionType;
		packageGraphs: PackageGraphs;
		preId: string | undefined;
		exact: boolean | undefined;
		logger?: Logger;
	}): Promise<void> {
		const {
			packageName, type, packageGraphs, preId, exact, logger,
		} = options;

		logger?.debug(styleText('dim', `Bumping package '${packageName}'...`));
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

		const updatedContent = findAndReplaceJsonVersion({
			raw: packageNode.packageData.rawContent,
			field: 'version',
			packageName,
			updatePackageName: packageName,
			newVersion: bumpedVersion,
			exact,
			logger,
		});

		const baseWrite = Bun.write(packageNode.packageData.path, updatedContent);

		const dependentWrites = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName).flatMap((dependent: PackageData) => {
			return Object.values(DependenciesField).flatMap((field) => {
				const entry = dependent[field];
				const depVersion = entry?.[packageName];
				if (!depVersion) {
					return [];
				}

				if (exact ? depVersion === bumpedVersion : semver.satisfies(bumpedVersion, depVersion)) {
					logger?.debug(styleText('dim', `Skipping '${dependent.name}': ${field} version '${depVersion}' already satisfies '${bumpedVersion}'.`));
					return [];
				}

				const updatedContent = findAndReplaceJsonVersion({
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
	}
}
