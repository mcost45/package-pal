import {
	mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync,
} from 'fs';
import {
	stat, readdir,
} from 'fs/promises';
import {
	join, resolve, basename, dirname, relative,
} from 'path';
import { $ } from 'bun';

const patchDeps = (
	catalogVersions: Map<string, string>, workspaceVersions: Map<string, string>, packageVersion: string, deps?: Record<string, string>,
) => {
	if (!deps) {
		return undefined;
	}

	const out: Record<string, string> = {};
	for (const [dep, version] of Object.entries(deps)) {
		if (version === '*') {
			out[dep] = packageVersion;
			continue;
		}

		const versionMapType = version.startsWith('catalog:') ? 'catalog' : (version.startsWith('workspace:') ? 'workspace' : undefined);
		const versionMap = versionMapType === 'catalog' ? catalogVersions : (versionMapType === 'workspace' ? workspaceVersions : undefined);
		if (!versionMapType || !versionMap) {
			out[dep] = version;
			continue;
		}

		const actual = versionMap.get(dep);
		if (!actual) {
			const capitalisedVersionType = versionMapType.charAt(0).toUpperCase() + versionMapType.slice(1);
			console.warn(`${capitalisedVersionType} version not found for: ${dep}`);
			continue;
		}

		const prefix = version.replace(`${versionMapType}:`, '') || '';
		out[dep] = prefix === '*' ? actual : prefix + actual;
	}

	return out;
};

const patchScriptPaths = (
	command: string, sourceDir: string, destDir: string,
): string => {
	const parts = command.split(' ');
	const newParts = parts.map((part) => {
		if (part.startsWith('./') || part.startsWith('../')) {
			try {
				const resolvedPath = resolve(sourceDir, part);

				if (!relative(sourceDir, resolvedPath).startsWith('..')) {
					const newPart = part.replace(/\\/g, '/');
					return newPart;
				}

				const newRelativePath = relative(destDir, resolvedPath);
				return newRelativePath.replace(/\\/g, '/');
			} catch {
				// Ignore
			}
		}
		return part;
	});

	return newParts.join(' ');
};

const dirName = Bun.argv[2];
if (!dirName) {
	throw new Error('Usage: bun run scripts/build-package.ts <package-dir>');
}

const root = resolve('.');
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
const workspaces: string[] | Record<string, unknown> = (rootPackage.workspaces as string[] | Record<string, unknown> | undefined) ?? [];
const workspaceGlobs = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []) as string[];

if (!workspaceGlobs.length) {
	throw new Error('No workspaces defined in root package.json');
}

const workspacePackagePaths: string[] = [];
for (const pattern of workspaceGlobs) {
	const globPattern = join(pattern, 'package.json');
	const glob = new Bun.Glob(globPattern);
	for await (const match of glob.scan({ absolute: true })) {
		workspacePackagePaths.push(match);
	}
}

const workspaceVersions = new Map<string, string>();
for (const path of workspacePackagePaths) {
	const packageContent = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
	if (packageContent.name && packageContent.version) {
		workspaceVersions.set(packageContent.name as string, packageContent.version as string);
	}
}

const catalogVersions = new Map(Object.entries(Array.isArray(workspaces) ? {} : (workspaces.catalog ?? {}) as Record<string, string>));

const matchPath = workspacePackagePaths.find(p => basename(dirname(p)) === dirName);
if (!matchPath) {
	throw new Error(`Could not find workspace package directory "${dirName}"`);
}

const packagePath = resolve(matchPath, '..');
const packageName = basename(packagePath);
const srcEntry = join(packagePath, 'src/index.ts');
const tsconfigPath = join(packagePath, 'tsconfig.lib.json');
const rootDist = resolve('dist', packageName);
const tsBuildDir = resolve('./.tsbuild', packageName);

if (!existsSync(srcEntry)) {
	throw new Error(`Missing entry file: ${srcEntry}.`);
}

if (!existsSync(tsconfigPath)) {
	throw new Error(`Missing tsconfig.lib.json in ${packagePath}.`);
}

rmSync(rootDist, {
	recursive: true,
	force: true,
});
rmSync(tsBuildDir, {
	recursive: true,
	force: true,
});
mkdirSync(rootDist, { recursive: true });

const sourcePackage = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8')) as Record<string, unknown>;

if (sourcePackage.exports) {
	console.log(`Building package: ${packageName}.`);
	await $`bun build ${srcEntry} --outdir ${rootDist} --target bun --format=esm --sourcemap=linked --packages=external`;
	await $`tsc --project ${tsconfigPath}`;
}

const flatFiles = new Set<string>();

async function trackAndCopyFilesRecursive(sourcePath: string, destPath: string) {
	const sourceStat = await stat(sourcePath);

	if (sourceStat.isFile()) {
		flatFiles.add(sourcePath);
		mkdirSync(dirname(destPath), { recursive: true });
		copyFileSync(sourcePath, destPath);
		console.log(`Copied file: ${sourcePath}.`);
		return;
	}

	mkdirSync(destPath, { recursive: true });
	const entries = await readdir(sourcePath, { withFileTypes: true });
	for (const entry of entries) {
		await trackAndCopyFilesRecursive(join(sourcePath, entry.name), join(destPath, entry.name));
	}
}

const filesField = (sourcePackage.files as string[] | undefined) ?? [];
for (const filePath of filesField) {
	const absSource = join(packagePath, filePath);
	const absDest = join(rootDist, filePath);

	if (!existsSync(absSource)) {
		console.warn(`File or directory specified in "files" not found: ${filePath}.`);
		continue;
	}

	await trackAndCopyFilesRecursive(absSource, absDest);
}

const fieldsToCopy = [
	'name',
	'version',
	'description',
	'keywords',
	'license',
	'type',
	'author',
	'repository',
	'dependencies',
	'peerDependencies',
	'devDependencies',
	'optionalDependencies',
	'engines',
	'bin',
	'files',
	'scripts',
	'sideEffects',
];

const keepScripts = new Set([
	'preinstall',
	'install',
	'postinstall',
	'prepublishOnly',
]);

const outPackage: Record<string, unknown> = {};
for (const field of fieldsToCopy) {
	if (field !== 'scripts' && field !== 'bin') {
		if (sourcePackage[field]) {
			outPackage[field] = sourcePackage[field];
		}

		continue;
	}

	if (field === 'bin' && sourcePackage.bin) {
		const filteredBin: Record<string, string> = {};
		const sourceBin = typeof sourcePackage.bin === 'string' ? { [sourcePackage.name as string]: sourcePackage.bin } : sourcePackage.bin;
		for (const [binName, binPath] of Object.entries(sourceBin)) {
			if (flatFiles.has(resolve(packagePath, binPath as string))) {
				filteredBin[binName] = binPath as string;
			}
		}

		if (Object.keys(filteredBin).length > 0) {
			outPackage.bin = filteredBin;
		}

		continue;
	}

	if (sourcePackage.scripts) {
		const filteredScripts: Record<string, string> = {};
		for (const [scriptName, scriptCommand] of Object.entries(sourcePackage.scripts)) {
			if (keepScripts.has(scriptName)) {
				filteredScripts[scriptName] = patchScriptPaths(
					scriptCommand as string, packagePath, rootDist,
				);
			}
		}

		if (Object.keys(filteredScripts).length > 0) {
			outPackage.scripts = filteredScripts;
		}
	}
}

outPackage.dependencies = patchDeps(
	catalogVersions, workspaceVersions, outPackage.version as string, outPackage.dependencies as Record<string, string> | undefined,
);
outPackage.peerDependencies = patchDeps(
	catalogVersions, workspaceVersions, outPackage.version as string, outPackage.peerDependencies as Record<string, string> | undefined,
);
outPackage.devDependencies = patchDeps(
	catalogVersions, workspaceVersions, outPackage.version as string, outPackage.devDependencies as Record<string, string> | undefined,
);
outPackage.optionalDependencies = patchDeps(
	catalogVersions, workspaceVersions, outPackage.version as string, outPackage.optionalDependencies as Record<string, string> | undefined,
);

if (sourcePackage.exports) {
	outPackage.exports = { '.': {
		import: './index.js',
		types: './index.d.ts',
	} };
}

writeFileSync(join(rootDist, 'package.json'), JSON.stringify(
	outPackage, null, 2,
));
console.log(`Wrote ${join(
	'dist', packageName, 'package.json',
)}.`);
