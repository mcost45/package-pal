import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths,
} from '@package-pal/core';
import { normalisePath } from '@package-pal/util';
import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { analyzeCpmFile } from './functions/analyze-cpm-file.ts';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
import { findCpmFile } from './functions/find-cpm-file.ts';
import { collectNodesByTags } from './functions/find-nodes.ts';
import { findAndParsePropertyFilesUpward } from './functions/find-property-files.ts';
import { getElementTextFromNode } from './functions/get-element-text.ts';
import { parseSln } from './functions/parse-sln.ts';
import { processAndYieldProjects } from './functions/process-and-yield-projects.ts';
import { updateMsbuildProperty } from './functions/update-msbuild-property.ts';
import { PackageVersionSourceType } from './types/package-version-source-type.ts';

// TODO-MC: Bun does not yet have a built-in XML parser. Once native XML support lands, migrate from 'txml'.

const extractReferenceVersion = (rawXml: string, packageName: string): string | undefined => {
	const dom = parse(rawXml);
	const tags = new Set(['PackageReference', 'PackageVersion']);
	const collected = collectNodesByTags(dom, tags);
	const packageRefs = collected.PackageReference;
	const packageVersions = collected.PackageVersion;
	const nodes = packageRefs
		? (packageVersions ? packageRefs.concat(packageVersions) : packageRefs)
		: (packageVersions ?? []);

	for (const node of nodes) {
		let includeVal: string | undefined;
		let updateVal: string | undefined;
		let versionAttr: string | undefined;

		for (const key in node.attributes) {
			const lowerKey = key.toLowerCase();
			if (lowerKey === 'include') {
				includeVal = node.attributes[key] ?? undefined;
			} else if (lowerKey === 'update') {
				updateVal = node.attributes[key] ?? undefined;
			} else if (lowerKey === 'version') {
				versionAttr = node.attributes[key] ?? undefined;
			}
		}

		if (includeVal === packageName || updateVal === packageName) {
			if (versionAttr) {
				return versionAttr;
			}
			const versionChild = node.children.find(child => child && typeof child === 'object' && child.tagName.toLowerCase() === 'version');
			if (versionChild && typeof versionChild === 'object') {
				return getElementTextFromNode(versionChild);
			}
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

	private directoryPropertyFilesCache = new Map<string, string[]>();
	private propertyFileCache = new Map<string, Map<string, string>>();
	private cpmCache = new Map<string, {
		raw: string;
		dom: (TNode | string)[];
		packageVersionNodes: TNode[];
	} | null>();

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

		const discoveredPaths: string[] = [];
		for await (const path of scanPackagePaths(patterns, cwd)) {
			discoveredPaths.push(path);
		}

		const localSolutionProjectsCache = new Map<string, string[]>();

		// Discover and parse all property files first
		for (const path of discoveredPaths) {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.sln') || lowerPath.endsWith('.slnx')) {
				logger?.debug(styleText('dim', `Parsing solution file '${path}'...`));
				const slnProjects = await parseSln([path], logger);
				localSolutionProjectsCache.set(path, slnProjects);
				for (const proj of slnProjects) {
					const normProjPath = normalisePath(proj);
					let projectPropertyMap = this.projectPropertyMaps.get(normProjPath);
					if (!projectPropertyMap) {
						projectPropertyMap = new Map<string, {
							value: string;
							filePath: string;
						}>();
						this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
					}
					await findAndParsePropertyFilesUpward(
						proj,
						projectPropertyMap,
						this.directoryPropertyFilesCache,
						this.propertyFileCache,
					);
				}
			} else if (lowerPath.endsWith('proj')) {
				const normProjPath = normalisePath(path);
				let projectPropertyMap = this.projectPropertyMaps.get(normProjPath);
				if (!projectPropertyMap) {
					projectPropertyMap = new Map<string, {
						value: string;
						filePath: string;
					}>();
					this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
				}
				await findAndParsePropertyFilesUpward(
					path,
					projectPropertyMap,
					this.directoryPropertyFilesCache,
					this.propertyFileCache,
				);
			}
		}

		for (const path of discoveredPaths) {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.sln') || lowerPath.endsWith('.slnx')) {
				logger?.debug(styleText('dim', `Retrieving cached projects for solution file '${path}'...`));
				const slnProjects = localSolutionProjectsCache.get(path) ?? [];
				yield* processAndYieldProjects(
					slnProjects, pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache,
				);
			} else if (lowerPath.endsWith('proj')) {
				yield* processAndYieldProjects(
					[path], pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache,
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
					for (const mPath of matchedPaths) {
						const normProjPath = normalisePath(mPath);
						let projectPropertyMap = this.projectPropertyMaps.get(normProjPath);
						if (!projectPropertyMap) {
							projectPropertyMap = new Map<string, {
								value: string;
								filePath: string;
							}>();
							this.projectPropertyMaps.set(normProjPath, projectPropertyMap);
						}
						await findAndParsePropertyFilesUpward(
							mPath,
							projectPropertyMap,
							this.directoryPropertyFilesCache,
							this.propertyFileCache,
						);
					}
					yield* processAndYieldProjects(
						matchedPaths, pathToName, yieldedPaths, logger, this.projectPropertyMaps, this.packageVersionProperties, this.cpmCache,
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
							const raw = await file.text();
							const updatedRaw = updateMsbuildProperty(
								raw, property.name, newVersion,
							);
							logger?.debug(styleText('dim',
								`Bumping backing MSBuild property '${property.name}' in '${property.filePath}' to ${newVersion}...`));
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
							const raw = await file.text();
							const result = bumpMsbuildReferenceVersion(
								raw, property.name, newVersion, true, logger, 'Directory.Packages.props',
							);
							if (result) {
								logger?.debug(styleText('dim', `Bumping backing CPM literal version for '${property.name}' in '${property.filePath}' to [${newVersion}]...`));
								await Bun.write(property.filePath, result.updatedRaw);
							}
							packageData.version = newVersion;
						}
					});
			}
		}

		return this.runLocked(packageData.path, async () => {
			const raw = packageData.rawContent;
			const updatedRaw = bumpMsbuildVersion(raw, newVersion);
			logger?.debug(styleText('dim', `Bumping MSBuild project '${packageData.name}' to ${newVersion}...`));
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
		const normalisedDependentPath = normalisePath(dependentPackageData.path);
		const projectPropertyMap = this.projectPropertyMaps.get(normalisedDependentPath);

		const cpmPath = findCpmFile(dependentPackageData.path);
		if (cpmPath) {
			const cpmResult = await this.runLocked(cpmPath, async () => {
				const file = Bun.file(cpmPath);
				if (await file.exists()) {
					const cpmRaw = await file.text();
					const status = analyzeCpmFile(cpmRaw, targetDependencyName);
					if (status.enabled && status.hasPackage) {
						const currentRefVersion = extractReferenceVersion(cpmRaw, targetDependencyName);
						if (currentRefVersion) {
							const propMatch = /^\$\(([^)]+)\)$/.exec(currentRefVersion.trim());
							if (propMatch?.[1]) {
								const propName = propMatch[1];
								const resolvedProp = projectPropertyMap?.get(propName.toLowerCase());
								if (resolvedProp) {
									await this.runLocked(resolvedProp.filePath, async () => {
										const propFileText = await Bun.file(resolvedProp.filePath).text();
										const updatedPropText = updateMsbuildProperty(
											propFileText, propName, newVersion,
										);
										logger?.debug(styleText('dim', `Updating backing MSBuild property '${propName}' in '${resolvedProp.filePath}' to ${newVersion}...`));
										await Bun.write(resolvedProp.filePath, updatedPropText);
										resolvedProp.value = newVersion;
									});
									return {
										handled: true,
										success: true,
									};
								}
							}
						}

						const result = bumpMsbuildReferenceVersion(
							cpmRaw, targetDependencyName, newVersion, exact, logger, 'Directory.Packages.props',
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
			const currentRefVersion = extractReferenceVersion(dependentRaw, targetDependencyName);
			if (currentRefVersion) {
				const propMatch = /^\$\(([^)]+)\)$/.exec(currentRefVersion.trim());
				if (propMatch?.[1]) {
					const propName = propMatch[1];
					const resolvedProp = projectPropertyMap?.get(propName.toLowerCase());
					if (resolvedProp) {
						await this.runLocked(resolvedProp.filePath, async () => {
							const propFileText = await Bun.file(resolvedProp.filePath).text();
							const updatedPropText = updateMsbuildProperty(
								propFileText, propName, newVersion,
							);
							logger?.debug(styleText('dim', `Updating backing MSBuild property '${propName}' in '${resolvedProp.filePath}' to ${newVersion}...`));
							await Bun.write(resolvedProp.filePath, updatedPropText);
							resolvedProp.value = newVersion;
						});
						return true;
					}
				}
			}

			const result = bumpMsbuildReferenceVersion(
				dependentRaw, targetDependencyName, newVersion, exact, logger, dependentPackageData.name,
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

	private runLocked<T>(filePath: string, action: () => Promise<T>): Promise<T> {
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
