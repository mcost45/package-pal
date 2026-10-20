import { resolve } from 'path';
import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths,
} from '@package-pal/core';
import {
	normalisePath, runAsync,
} from '@package-pal/util';
import type { XML } from 'bun';
import { analyzeCpmFile } from './functions/analyze-cpm-file.ts';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
import { findCpmFile } from './functions/find-cpm-file.ts';
import { findAndParsePropertyFilesUpward } from './functions/find-property-files.ts';
import { parseSln } from './functions/parse-sln.ts';
import { processAndYieldProjects } from './functions/process-and-yield-projects.ts';
import { updateMsbuildProperty } from './functions/update-msbuild-property.ts';
import {
	attribute, parseProject, decodeXml, elementText, elements, walkElements,
} from './functions/xml.ts';
import { PackageVersionSourceType } from './types/package-version-source-type.ts';

const propertyDiscoveryConcurrency = 16;

const extractReferenceVersion = (root: XML.Node, packageName: string): string | undefined => {
	for (const node of walkElements(root)) {
		if (!['packagereference', 'packageversion'].includes(node.name.toLowerCase())) continue;
		if (attribute(node, 'Include') === packageName || attribute(node, 'Update') === packageName) {
			return attribute(node, 'Version') ?? elementText(elements(node).find(child => child.name.toLowerCase() === 'version'));
		}
	}
	return undefined;
};

export class MsbuildAdapter extends PackageAdapter {
	readonly name = 'msbuild' as const;
	readonly manifestPattern = '*.*proj' as const;
	readonly defaultPatterns = [
		'**/*.sln',
		'**/*.slnx',
		'**/*.*proj',
	];

	private fileMutexes = new Map<string, Promise<void>>();

	// Scoped Property Engine Caches
	private projectPropertyMaps = new Map<string, Map<string, {
		value: string;
		filePath: string;
	}>>();

	private packageVersionProperties = new Map<string, {
		type: PackageVersionSourceType;
		name: string;
		filePath: string;
	}>();

	private directoryPropertyFilesCache = new Map<string, Promise<string[]>>();
	private propertyFileCache = new Map<string, Promise<Map<string, string>>>();
	private cpmCache = new Map<string, Map<string, string>>();

	private cpmPathCache = new Map<string, string | null>();

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

		// Clear caches for a fresh, consistent scanning cycle
		this.projectPropertyMaps.clear();
		this.packageVersionProperties.clear();
		this.directoryPropertyFilesCache.clear();
		this.propertyFileCache.clear();
		this.cpmCache.clear();
		this.cpmPathCache.clear();

		const discoveredPaths: string[] = [];
		for await (const path of scanPackagePaths(patterns, cwd)) {
			discoveredPaths.push(path);
		}

		const localSolutionProjectsCache = new Map<string, string[]>();
		const projectPropertyPromises = new Map<string, Promise<void>>();

		// Discover and parse all property files first (concurrently)
		const propertyTasks = discoveredPaths.map(path => async () => {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.sln') || lowerPath.endsWith('.slnx')) {
				logger?.debug(styleText('dim', `Parsing solution file '${path}'...`));
				const slnProjects = await parseSln([path], logger);
				localSolutionProjectsCache.set(path, slnProjects);
				for (const proj of slnProjects) {
					const normProjPath = normalisePath(proj);
					let projectPromise = projectPropertyPromises.get(normProjPath);
					if (!projectPromise) {
						const projectPropertyMap = new Map<string, {
							value: string;
							filePath: string;
						}>();
						this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
						projectPromise = findAndParsePropertyFilesUpward(
							proj,
							projectPropertyMap,
							this.directoryPropertyFilesCache,
							this.propertyFileCache,
						);
						projectPropertyPromises.set(normProjPath, projectPromise);
					}
					await projectPromise;
				}
			} else if (lowerPath.endsWith('proj')) {
				const normProjPath = normalisePath(path);
				let projectPromise = projectPropertyPromises.get(normProjPath);
				if (!projectPromise) {
					const projectPropertyMap = new Map<string, {
						value: string;
						filePath: string;
					}>();
					this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
					projectPromise = findAndParsePropertyFilesUpward(
						path,
						projectPropertyMap,
						this.directoryPropertyFilesCache,
						this.propertyFileCache,
					);
					projectPropertyPromises.set(normProjPath, projectPromise);
				}
				await projectPromise;
			}
		});

		await runAsync(propertyTasks, propertyDiscoveryConcurrency);

		for (const path of discoveredPaths) {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.sln') || lowerPath.endsWith('.slnx')) {
				logger?.debug(styleText('dim', `Retrieving cached projects for solution file '${path}'...`));
				const slnProjects = localSolutionProjectsCache.get(path) ?? [];
				yield* processAndYieldProjects(
					slnProjects, pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache, this.cpmPathCache,
				);
			} else if (lowerPath.endsWith('proj')) {
				yield* processAndYieldProjects(
					[path], pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache, this.cpmPathCache,
				);
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
					const compatTasks = matchedPaths.map(mPath => async () => {
						const normProjPath = normalisePath(mPath);
						let projectPromise = projectPropertyPromises.get(normProjPath);
						if (!projectPromise) {
							const projectPropertyMap = new Map<string, {
								value: string;
								filePath: string;
							}>();
							this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
							projectPromise = findAndParsePropertyFilesUpward(
								mPath,
								projectPropertyMap,
								this.directoryPropertyFilesCache,
								this.propertyFileCache,
							);
							projectPropertyPromises.set(normProjPath, projectPromise);
						}
						await projectPromise;
					});
					await runAsync(compatTasks, propertyDiscoveryConcurrency);

					yield* processAndYieldProjects(
						matchedPaths, pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache, this.cpmPathCache,
					);
				}
			}
		}
	}

	async bumpOwnVersion(
		packageData: PackageData, newVersion: string, logger?: Logger,
	): Promise<void> {
		const normalisedPath = normalisePath(packageData.path);
		const property = this.packageVersionProperties.get(normalisedPath);

		if (property) {
			switch (property.type) {
				case PackageVersionSourceType.Property:
					return this.runLocked(property.filePath, async () => {
						const file = Bun.file(property.filePath);
						if (await file.exists()) {
							const raw = decodeXml(await file.bytes());
							const updatedRaw = updateMsbuildProperty(
								raw, property.name, newVersion,
							);
							logger?.info(`Updating '${property.filePath}' MSBuild property '${property.name}': ${packageData.version ?? ''} → ${newVersion}.`);
							await Bun.write(property.filePath, updatedRaw);

							const projectPropertyMap = this.projectPropertyMaps.get(normalisedPath);
							const mapped = projectPropertyMap?.get(property.name.toLowerCase());
							if (mapped) {
								mapped.value = newVersion;
							}

							packageData.version = newVersion;
						}
					});

				case PackageVersionSourceType.CpmLiteral:
					return this.runLocked(property.filePath, async () => {
						const file = Bun.file(property.filePath);
						if (await file.exists()) {
							const raw = decodeXml(await file.bytes());
							const result = bumpMsbuildReferenceVersion(
								raw, property.name, newVersion, true, logger, 'Directory.Packages.props',
							);
							if (result) {
								logger?.debug(styleText('dim', `Updated backing CPM literal version for '${property.name}' in '${property.filePath}' to [${newVersion}].`));
								await Bun.write(property.filePath, result.updatedRaw);
							}
							packageData.version = newVersion;
						}
					});
			}
		}

		return this.runLocked(packageData.path, async () => {
			const raw = decodeXml(await Bun.file(packageData.path).bytes());
			const updatedRaw = bumpMsbuildVersion(raw, newVersion);
			logger?.info(`Updating '${packageData.name}' project version: ${packageData.version ?? ''} → ${newVersion}.`);
			await Bun.write(packageData.path, updatedRaw);
			packageData.rawContent = updatedRaw;
			packageData.version = newVersion;
		});
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger?: Logger,
	): Promise<boolean> {
		const projectPropertyMap = this.projectPropertyMaps.get(normalisePath(dependentPackageData.path));
		let referencePath = dependentPackageData.path;
		let referenceRoot = parseProject(await Bun.file(referencePath).bytes());
		const cpmPath = findCpmFile(referencePath, this.cpmPathCache);
		if (cpmPath) {
			const cpmRoot = parseProject(await Bun.file(cpmPath).bytes());
			const status = analyzeCpmFile(cpmRoot, targetDependencyName);
			if (status.enabled && status.hasPackage) {
				referencePath = cpmPath;
				referenceRoot = cpmRoot;
			}
		}

		const currentRefVersion = extractReferenceVersion(referenceRoot, targetDependencyName);
		const propName = currentRefVersion ? /^\$\(([^)]+)\)$/.exec(currentRefVersion.trim())?.[1] : undefined;
		const resolvedProp = propName ? projectPropertyMap?.get(propName.toLowerCase()) : undefined;
		// Resolve the destination before locking: a property can live in the reference file itself.
		const destination = resolvedProp?.filePath ?? referencePath;
		return this.runLocked(destination, async () => {
			const raw = decodeXml(await Bun.file(destination).bytes());
			let updatedRaw: string;
			if (resolvedProp && propName) {
				updatedRaw = updateMsbuildProperty(
					raw, propName, newVersion,
				);
				logger?.debug(styleText('dim', `Updating backing MSBuild property '${propName}' in '${destination}' to ${newVersion}...`));
				resolvedProp.value = newVersion;
			} else {
				const result = bumpMsbuildReferenceVersion(
					raw, targetDependencyName, newVersion, exact, logger, dependentPackageData.name,
				);
				if (!result) {
					return false;
				}
				updatedRaw = result.updatedRaw;
			}

			await Bun.write(destination, updatedRaw);
			if (normalisePath(destination) === normalisePath(dependentPackageData.path)) {
				dependentPackageData.rawContent = updatedRaw;
			}
			return true;
		});
	}

	private runLocked<T>(filePath: string, action: () => Promise<T>): Promise<T> {
		filePath = normalisePath(resolve(filePath));
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
