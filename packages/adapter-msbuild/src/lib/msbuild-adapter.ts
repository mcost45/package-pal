import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths,
} from '@package-pal/core';
import { formatUnknownError } from '@package-pal/util';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
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
		patterns: string[],
		logger?: Logger,
		cwd?: string,
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
					logger?.debug(styleText('dim', `Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
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
						logger?.debug(styleText('dim', `Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
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
							logger?.debug(styleText('dim', `Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
						}
					}
				}
			}
		}
	}

	async bumpOwnVersion(
		packageData: PackageData,
		newVersion: string,
		logger?: Logger,
	): Promise<void> {
		const raw = packageData.rawContent;
		const updatedRaw = bumpMsbuildVersion(raw, newVersion);
		logger?.debug(styleText('dim', `Bumping MSBuild project '${packageData.name}' to ${newVersion}...`));
		await Bun.write(packageData.path, updatedRaw);
		packageData.rawContent = updatedRaw;
	}

	async bumpDependencyVersion(
		dependentPackageData: PackageData,
		targetDependencyName: string,
		newVersion: string,
		exact: boolean,
		logger?: Logger,
	): Promise<boolean> {
		const dependentRaw = dependentPackageData.rawContent;
		const result = bumpMsbuildReferenceVersion(
			dependentRaw, targetDependencyName, newVersion,
		);

		if (result) {
			logger?.debug(styleText('dim', `Updating '${dependentPackageData.name}' PackageReference '${targetDependencyName}' to ${newVersion}.`));
			await Bun.write(dependentPackageData.path, result.updatedRaw);
			dependentPackageData.rawContent = result.updatedRaw;
			return true;
		}

		return false;
	}
}
