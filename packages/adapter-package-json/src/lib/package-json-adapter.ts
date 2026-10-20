import {
	dirname, join, resolve,
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
	dependencyFields, packageDataFromManifest, parsePackageManifest, serializePackageJson,
} from './functions/parse-package-json.ts';
import type { PackageManifest } from './functions/parse-package-json.ts';

const updateRange = (current: string, version: string): string => {
	const workspace = current.startsWith('workspace:') ? 'workspace:' : '';
	const range = workspace ? current.slice(workspace.length) : current;
	const match = /(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)$/.exec(range);
	const updated = match ? range.slice(0, match.index) + version : `${range.startsWith('~') ? '~' : '^'}${version}`;
	// Replacing an upper bound (e.g. <2.0.0) must not exclude the new version.
	return workspace + (semver.satisfies(version, updated) ? updated : `^${version}`);
};

export class PackageJsonAdapter extends PackageAdapter {
	readonly name = 'package-json' as const;
	readonly manifestPattern = 'package.json' as const;
	readonly defaultPatterns = ['packages/*'];
	private fileUpdates = new Map<string, Promise<void>>();

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
				const packageData = packageDataFromManifest(
					packagePath, text, parsePackageManifest(text),
				);

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
		await this.updateManifest(packageData, (manifest) => {
			if (manifest.version === newVersion) return false;
			logger?.info(`Updating '${packageData.name}' version: ${manifest.version ?? ''} → ${newVersion}.`);
			manifest.version = newVersion;
			return true;
		});
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger?: Logger,
	): Promise<boolean> {
		return this.updateManifest(dependentPackageData, (manifest) => {
			let modified = false;

			for (const field of dependencyFields) {
				const entry = manifest[field];
				if (!entry || !Object.hasOwn(entry, targetDependencyName)) continue;
				const depVersion = entry[targetDependencyName];
				if (depVersion === undefined) {
					continue;
				}

				const cleanRange = depVersion.startsWith('workspace:')
					? depVersion.slice('workspace:'.length)
					: depVersion;

				const canOptimize = /\d/.test(cleanRange);

				if (exact ? depVersion === newVersion : canOptimize && semver.satisfies(newVersion, cleanRange)) {
					logger?.debug(styleText('dim', `Skipping '${dependentPackageData.name}': ${field} version '${depVersion}' already satisfies '${newVersion}'.`));
					continue;
				}

				const updatedVersion = exact ? newVersion : updateRange(depVersion, newVersion);
				if (updatedVersion === depVersion) continue;
				entry[targetDependencyName] = updatedVersion;
				logger?.info(`Updating '${dependentPackageData.name}' ${field} '${targetDependencyName}': ${depVersion} → ${updatedVersion}.`);
				modified = true;
			}

			return modified;
		});
	}

	private async updateManifest(packageData: PackageData, update: (manifest: PackageManifest) => boolean): Promise<boolean> {
		const path = resolve(packageData.path);
		const previous = this.fileUpdates.get(path) ?? Promise.resolve();
		const current = previous.then(async () => {
			const raw = await Bun.file(path).text();
			const manifest = parsePackageManifest(raw);
			const modified = update(manifest);
			const updated = modified ? serializePackageJson(manifest, raw) : raw;
			if (modified) await Bun.write(path, updated);
			Object.assign(packageData, packageDataFromManifest(
				packageData.path, updated, manifest,
			));
			return modified;
		});
		// A failed edit must not block later edits of the same file.
		const finished = current.then(() => undefined, () => undefined);
		this.fileUpdates.set(path, finished);
		try {
			return await current;
		} finally {
			if (this.fileUpdates.get(path) === finished) this.fileUpdates.delete(path);
		}
	}
}
