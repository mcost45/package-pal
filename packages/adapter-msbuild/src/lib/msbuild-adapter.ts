import { styleText } from 'util';
import type {
	Logger, PackageData, PackageGraphs, BumpVersionType,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths, dfsTraverseGraph,
} from '@package-pal/core';
import {
	formatUnknownError, normalisePath,
} from '@package-pal/util';
import { inc } from 'semver';
import {
	parse, type TNode,
} from 'txml/txml';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
import { parseMsbuild } from './functions/parse-msbuild.ts';
import { resolveMsbuildName } from './functions/resolve-msbuild-name.ts';

// TODO-MC: Bun does not yet have a built-in XML parser. Once native XML support lands, migrate from 'txml'.

export class MsbuildAdapter extends PackageAdapter {
	readonly name = 'msbuild' as const;
	readonly manifestPattern = '*.*proj' as const;

	async detect(cwd: string): Promise<boolean> {
		try {
			const globSln = new Bun.Glob('*.sln');
			for await (const _ of globSln.scan({ cwd })) {
				return true;
			}
			const globProj = new Bun.Glob(this.manifestPattern);
			for await (const _ of globProj.scan({ cwd })) {
				return true;
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
		const fileEntries: {
			path: string;
			text: string;
			dom: (TNode | string)[];
		}[] = [];
		const pathToName = new Map<string, string>();

		// Pass 1: Resolve names and paths
		for await (const folderPath of scanPackagePaths(patterns, cwd)) {
			// Find all project files matching *.*proj
			const glob = new Bun.Glob(this.manifestPattern);
			for await (const manifestPath of glob.scan({
				cwd: folderPath,
				absolute: true,
			})) {
				try {
					logger?.debug(styleText('dim', `Trying to read MSBuild project in '${manifestPath}'.`));
					const file = Bun.file(manifestPath);

					if (!file.size) {
						logger?.debug(styleText('dim', `Failed to read project manifest in '${manifestPath}' - ${styleText('red', 'File empty or not found')}.`));
						continue;
					}

					const text = await file.text();
					const dom = parse(text);
					const name = resolveMsbuildName(manifestPath, dom);

					if (name) {
						pathToName.set(normalisePath(manifestPath), name);
						fileEntries.push({
							path: manifestPath,
							text,
							dom,
						});
					}
				} catch (e: unknown) {
					logger?.debug(styleText('dim', `Failed to read project in '${manifestPath}' - ${styleText('red', formatUnknownError(e))}.`));
				}
			}
		}

		// Pass 2: Map project-to-project references and return parsed PackageData
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
				logger?.debug(styleText('dim', `Failed to parse project in '${entry.path}' - ${styleText('red', formatUnknownError(e))}.`));
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
			packageName, type, packageGraphs, preId, logger,
		} = options;

		logger?.debug(styleText('dim', `Bumping MSBuild project '${packageName}'...`));
		const packageNode = packageGraphs.dependencies.get(packageName);
		if (!packageNode) {
			throw new Error(`Package '${packageName}' not found.`);
		}

		const currentVersion = packageNode.packageData.version ?? '1.0.0';
		const bumpedVersion = inc(
			currentVersion, type, undefined, preId,
		);
		if (!bumpedVersion) {
			throw new Error(`Package '${packageName}' version '${currentVersion}' is invalid.`);
		}

		// 1. Update project file's own version
		const raw = packageNode.packageData.rawContent;
		const updatedRaw = bumpMsbuildVersion(raw, bumpedVersion);
		const baseWrite = Bun.write(packageNode.packageData.path, updatedRaw);

		// 2. Update package references in dependent projects
		const dependentWrites = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName).flatMap((dependent: PackageData) => {
			const dependentRaw = dependent.rawContent;
			const updatedDependentRaw = bumpMsbuildReferenceVersion(
				dependentRaw, packageName, bumpedVersion,
			);

			if (updatedDependentRaw) {
				logger?.info(`Updating dependent project '${dependent.name}' reference: ${packageName} → ${bumpedVersion}.`);
				return [Bun.write(dependent.path, updatedDependentRaw)];
			}

			return [];
		}));

		return Promise.all([baseWrite, ...dependentWrites]).then(() => undefined);
	}
}
