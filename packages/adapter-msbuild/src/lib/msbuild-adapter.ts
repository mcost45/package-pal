import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths,
} from '@package-pal/core';
import { formatUnknownError } from '@package-pal/util';
import { analyzeCpmFile } from './functions/analyze-cpm-file.ts';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
import { findCpmFile } from './functions/find-cpm-file.ts';
import { parseMsbuild } from './functions/parse-msbuild.ts';
import { parseSln } from './functions/parse-sln.ts';
import { readProjects } from './functions/read-projects.ts';

// TODO-MC: Bun does not yet have a built-in XML parser. Once native XML support lands, migrate from 'txml'.

export class MsbuildAdapter extends PackageAdapter {
	readonly name = 'msbuild' as const;
	readonly manifestPattern = '*.*proj' as const;
	readonly defaultPatterns = [
		'**/*.sln',
		'**/*.slnx',
		'**/*.*proj',
	];

	private fileMutexes = new Map<string, Promise<void>>();

	async detect(cwd: string): Promise<boolean> {
		try {
			const scanPatterns = [
				'*.sln',
				'*/*.sln',
				'*.slnx',
				'*/*.slnx',
				this.manifestPattern,
				`*/${this.manifestPattern}`,
			];

			for (const pattern of scanPatterns) {
				const glob = new Bun.Glob(pattern);
				for await (const _ of glob.scan({ cwd })) {
					return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	async* scanPackages(
		patterns: string[], logger?: Logger, cwd?: string,
	): AsyncIterable<PackageData> {
		const pathToName = new Map<string, string>();
		const yieldedPaths = new Set<string>();

		const processProject = async function* (manifestPath: string): AsyncIterable<PackageData> {
			if (yieldedPaths.has(manifestPath)) return;
			yieldedPaths.add(manifestPath);

			const fileEntries = await readProjects(
				[manifestPath], pathToName, logger,
			);
			for (const entry of fileEntries) {
				try {
					const packageData = parseMsbuild(
						entry.path, entry.text, entry.dom, pathToName,
					);
					if (packageData) {
						logger?.debug(styleText('dim', `Successfully read MSBuild project in '${entry.path}'.`));
						yield packageData;
					}
				} catch (e: unknown) {
					logger?.debug(styleText('dim',
						`Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
				}
			}
		};

		for await (const path of scanPackagePaths(patterns, cwd)) {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.sln') || lowerPath.endsWith('.slnx')) {
				logger?.debug(styleText('dim', `Parsing solution file '${path}'...`));
				const slnProjects = await parseSln([path], logger);
				const fileEntries = await readProjects(
					slnProjects, pathToName, logger,
				);
				for (const entry of fileEntries) {
					if (yieldedPaths.has(entry.path)) continue;
					yieldedPaths.add(entry.path);
					try {
						const packageData = parseMsbuild(
							entry.path, entry.text, entry.dom, pathToName,
						);
						if (packageData) {
							logger?.debug(styleText('dim', `Successfully read MSBuild project in '${entry.path}'.`));
							yield packageData;
						}
					} catch (e: unknown) {
						logger?.debug(styleText('dim',
							`Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
					}
				}
			} else if (lowerPath.endsWith('proj')) {
				yield* processProject(path);
			} else {
				// Backward compatibility for directory paths like packages/*
				const glob = new Bun.Glob(this.manifestPattern);
				const matchedPaths: string[] = [];
				for await (const manifestPath of glob.scan({
					cwd: path,
					absolute: true,
				})) {
					matchedPaths.push(manifestPath);
				}

				if (matchedPaths.length > 0) {
					const fileEntries = await readProjects(
						matchedPaths, pathToName, logger,
					);
					for (const entry of fileEntries) {
						if (yieldedPaths.has(entry.path)) continue;
						yieldedPaths.add(entry.path);
						try {
							const packageData = parseMsbuild(
								entry.path, entry.text, entry.dom, pathToName,
							);
							if (packageData) {
								logger?.debug(styleText('dim', `Successfully read MSBuild project in '${entry.path}'.`));
								yield packageData;
							}
						} catch (e: unknown) {
							logger?.debug(styleText('dim',
								`Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
						}
					}
				}
			}
		}
	}

	async bumpOwnVersion(
		packageData: PackageData, newVersion: string, logger?: Logger,
	): Promise<void> {
		return this.runLocked(packageData.path, async () => {
			const raw = packageData.rawContent;
			const updatedRaw = bumpMsbuildVersion(raw, newVersion);
			logger?.debug(styleText('dim', `Bumping MSBuild project '${packageData.name}' to ${newVersion}...`));
			await Bun.write(packageData.path, updatedRaw);
			packageData.rawContent = updatedRaw;
		});
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger?: Logger,
	): Promise<boolean> {
		const cpmPath = findCpmFile(dependentPackageData.path);
		if (cpmPath) {
			const cpmResult = await this.runLocked(cpmPath, async () => {
				const file = Bun.file(cpmPath);
				if (await file.exists()) {
					const cpmRaw = await file.text();
					const status = analyzeCpmFile(cpmRaw, targetDependencyName);
					if (status.enabled && status.hasPackage) {
						const result = bumpMsbuildReferenceVersion(
							cpmRaw, targetDependencyName, newVersion,
						);
						if (result) {
							logger?.debug(styleText('dim',
								`Updating CPM file '${cpmPath}' PackageVersion '${targetDependencyName}' to ${newVersion}.`));
							await Bun.write(cpmPath, result.updatedRaw);
							return {
								handled: true,
								success: true,
							};
						}
						return {
							handled: true,
							success: false,
						};
					}
					if (!status.enabled) {
						return {
							handled: false,
							success: false,
						};
					}
				}
				return {
					handled: false,
					success: false,
				};
			});

			if (cpmResult.handled) {
				return cpmResult.success;
			}
		}

		return this.runLocked(dependentPackageData.path, async () => {
			const dependentRaw = dependentPackageData.rawContent;
			const result = bumpMsbuildReferenceVersion(
				dependentRaw, targetDependencyName, newVersion,
			);

			if (result) {
				logger?.debug(styleText('dim',
					`Updating '${dependentPackageData.name}' PackageReference '${targetDependencyName}' to ${newVersion}.`));
				await Bun.write(dependentPackageData.path, result.updatedRaw);
				dependentPackageData.rawContent = result.updatedRaw;
				return true;
			}

			return false;
		});
	}

	private async runLocked<T>(filePath: string, action: () => Promise<T>): Promise<T> {
		const previous = this.fileMutexes.get(filePath) ?? Promise.resolve();
		const current = (async () => {
			await previous.catch(() => {
				// Ignore previous errors so subsequent runs are not blocked
			});
			return action();
		})();

		const currentPromise = current.then(() => {
			// Convert to Promise<void>
		},
		() => {
			// Ignore errors
		});

		this.fileMutexes.set(filePath, currentPromise);

		void currentPromise.then(() => {
			if (this.fileMutexes.get(filePath) === currentPromise) {
				this.fileMutexes.delete(filePath);
			}
		});

		return current;
	}
}
