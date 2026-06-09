import { styleText } from 'util';
import type {
	Logger, PackageData, PackageGraphs, BumpVersionType,
} from '@package-pal/core';
import {
	PackageAdapter, scanPackagePaths, dfsTraverseGraph,
} from '@package-pal/core';
import { inc } from 'semver';
import { bumpMsbuildReferenceVersion } from './functions/bump-msbuild-reference-version.ts';
import { bumpMsbuildVersion } from './functions/bump-msbuild-version.ts';
import { parseMsbuild } from './functions/parse-msbuild.ts';
import { parseSln } from './functions/parse-sln.ts';
import type { ProjectFileEntry } from './functions/read-projects.ts';
import { readProjects } from './functions/read-projects.ts';

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
			const globSubSln = new Bun.Glob('*/*.sln');
			for await (const _ of globSubSln.scan({ cwd })) {
				return true;
			}
			const globSlnx = new Bun.Glob('*.slnx');
			for await (const _ of globSlnx.scan({ cwd })) {
				return true;
			}
			const globSubSlnx = new Bun.Glob('*/*.slnx');
			for await (const _ of globSubSlnx.scan({ cwd })) {
				return true;
			}
			const globProj = new Bun.Glob(this.manifestPattern);
			for await (const _ of globProj.scan({ cwd })) {
				return true;
			}
			const globSubProj = new Bun.Glob(`*/${this.manifestPattern}`);
			for await (const _ of globSubProj.scan({ cwd })) {
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
		const pathToName = new Map<string, string>();
		const activeCwd = cwd ?? process.cwd();

		let projectPaths: string[] = [];
		let slnParsed = false;

		// Zero-config solution parsing: active only for the default pattern
		if (patterns.length === 1 && patterns[0] === 'packages/*') {
			const solutionPaths: string[] = [];
			const globSln = new Bun.Glob('*.sln');
			for await (const slnPath of globSln.scan({
				cwd: activeCwd,
				absolute: true,
			})) {
				solutionPaths.push(slnPath);
			}
			const globSubSln = new Bun.Glob('*/*.sln');
			for await (const slnPath of globSubSln.scan({
				cwd: activeCwd,
				absolute: true,
			})) {
				solutionPaths.push(slnPath);
			}
			const globSlnx = new Bun.Glob('*.slnx');
			for await (const slnPath of globSlnx.scan({
				cwd: activeCwd,
				absolute: true,
			})) {
				solutionPaths.push(slnPath);
			}
			const globSubSlnx = new Bun.Glob('*/*.slnx');
			for await (const slnPath of globSubSlnx.scan({
				cwd: activeCwd,
				absolute: true,
			})) {
				solutionPaths.push(slnPath);
			}

			if (solutionPaths.length > 0) {
				logger?.debug(styleText('dim', `Detected ${solutionPaths.length.toString()} solution file(s). Extracting project paths...`));
				projectPaths = await parseSln(solutionPaths, logger);
				if (projectPaths.length > 0) {
					slnParsed = true;
				}
			}
		}

		// Fallback to pattern-based globbing
		if (!slnParsed) {
			const globbedPaths: string[] = [];
			for await (const folderPath of scanPackagePaths(patterns, cwd)) {
				const glob = new Bun.Glob(this.manifestPattern);
				for await (const manifestPath of glob.scan({
					cwd: folderPath,
					absolute: true,
				})) {
					globbedPaths.push(manifestPath);
				}
			}
			projectPaths = globbedPaths;
		}

		// Read and parse all projects
		const fileEntries: ProjectFileEntry[] = await readProjects(
			projectPaths, pathToName, logger,
		);

		// Map project-to-project references and return parsed PackageData
		for (const entry of fileEntries) {
			try {
				const packageData = parseMsbuild(
					entry.path, entry.text, entry.dom, pathToName,
				);
				if (packageData) {
					logger?.debug(styleText('dim', `Successfully read MSBuild project in '${entry.path}'.`));
					yield packageData;
				}
				// eslint-disable-next-line unused-imports/no-unused-vars
			} catch (_e: unknown) {
				//
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
		logger?.info(`Updating '${packageName}' version: ${currentVersion} → ${bumpedVersion}.`);
		const baseWrite = Bun.write(packageNode.packageData.path, updatedRaw);

		// 2. Update package references in dependent projects
		const dependentWrites = Array.from(dfsTraverseGraph(packageGraphs.dependents, packageName).flatMap((dependent: PackageData) => {
			const dependentRaw = dependent.rawContent;
			const result = bumpMsbuildReferenceVersion(
				dependentRaw, packageName, bumpedVersion,
			);

			if (result) {
				logger?.info(`Updating '${dependent.name}' PackageReference '${packageName}': ${result.currentVersion} → ${bumpedVersion}.`);
				return [Bun.write(dependent.path, result.updatedRaw)];
			}

			return [];
		}));

		return Promise.all([baseWrite, ...dependentWrites]).then(() => undefined);
	}
}
