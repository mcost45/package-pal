import {
	dirname, join,
} from 'path';
import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths,
} from '@package-pal/core';
import { formatUnknownError } from '@package-pal/util';
import { semver } from 'bun';
import {
	findAndReplaceJsonVersion, DependenciesField,
} from './functions/find-and-replace-json-version.ts';
import { parsePackageJson } from './functions/parse-package-json.ts';

export class PackageJsonAdapter extends PackageAdapter {
	readonly name = 'package-json' as const;
	readonly manifestPattern = 'package.json' as const;
	readonly defaultPatterns = ['packages/*'];

	async detect(cwd: string): Promise<boolean> {
		try {
			const file = Bun.file(join(cwd, 'package.json'));
			return await file.exists();
		} catch {
			return false;
		}
	}

	async* scanPackages(
		patterns: string[],
		logger?: Logger,
		cwd?: string,
	): AsyncIterable<PackageData> {
		for await (const path of scanPackagePaths(patterns, cwd)) {
			const packagePath = join(path, 'package.json');
			const dir = dirname(packagePath);

			try {
				logger?.debug(styleText('dim', `Trying to read package.json in '${dir}'.`));
				const file = Bun.file(packagePath);

				if (!file.size) {
					logger?.debug(styleText('dim', `Failed to read package.json in '${dir}' - ${styleText('red', 'File not found or empty')}.`));
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

	async bumpOwnVersion(
		packageData: PackageData,
		newVersion: string,
		logger?: Logger,
	): Promise<void> {
		const updatedContent = findAndReplaceJsonVersion({
			raw: packageData.rawContent,
			field: 'version',
			packageName: packageData.name,
			updatePackageName: packageData.name,
			newVersion,
			exact: true,
			logger,
		});

		await Bun.write(packageData.path, updatedContent);
		packageData.rawContent = updatedContent;
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger?: Logger,
	): Promise<boolean> {
		let modified = false;
		let updatedContent = dependentPackageData.rawContent;

		for (const field of Object.values(DependenciesField)) {
			const entry = dependentPackageData[field as keyof PackageData] as Record<string, string> | undefined;
			const depVersion = entry?.[targetDependencyName];
			if (!depVersion) {
				continue;
			}

			const cleanRange = depVersion.startsWith('workspace:')
				? depVersion.slice('workspace:'.length)
				: depVersion;

			const canOptimize = /\d/.test(cleanRange);

			if (canOptimize && (exact ? depVersion === newVersion : semver.satisfies(newVersion, cleanRange))) {
				logger?.debug(styleText('dim', `Skipping '${dependentPackageData.name}': ${field} version '${depVersion}' already satisfies '${newVersion}'.`));
				continue;
			}

			updatedContent = findAndReplaceJsonVersion({
				raw: updatedContent,
				field,
				packageName: targetDependencyName,
				updatePackageName: dependentPackageData.name,
				newVersion,
				exact,
				logger,
			});
			modified = true;
		}

		if (modified) {
			await Bun.write(dependentPackageData.path, updatedContent);
			dependentPackageData.rawContent = updatedContent;
			return true;
		}

		return false;
	}
}
