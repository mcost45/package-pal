import {
	mkdirSync, rmSync,
} from 'fs';
import {
	writeFile, chmod,
} from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';
import cliPackageJson from '../packages/cli/package.json';
import { assertDefined } from '@package-pal/util';

const uniqueBinaryCliVersions = new Set(Object.values(cliPackageJson.optionalDependencies));
if (uniqueBinaryCliVersions.size > 1) {
	throw new Error(`Mismatched versions found in optionalDependencies in 'packages/cli/package.json': ${Array.from(uniqueBinaryCliVersions).map(version => `'${version}'`)
		.join(', ')}. All binary packages must have the same version.`);
}

const entry = './packages/cli/src/index.ts';
const outDir = './dist';
const name = assertDefined(Object.keys(cliPackageJson.bin)[0]);
const license = cliPackageJson.license;
const bunVersion = Bun.version;

const targets = [
	// Linux
	{
		target: 'bun-linux-x64',
		folder: 'cli-linux-x64',
		os: 'linux',
		cpu: 'x64',
	},
	{
		target: 'bun-linux-x64-musl',
		folder: 'cli-linux-x64-musl',
		os: 'linux',
		cpu: 'x64',
	},
	{
		target: 'bun-linux-arm64',
		folder: 'cli-linux-arm64',
		os: 'linux',
		cpu: 'arm64',
	},
	{
		target: 'bun-linux-arm64-musl',
		folder: 'cli-linux-arm64-musl',
		os: 'linux',
		cpu: 'arm64',
	},
	// macOS
	{
		target: 'bun-darwin-arm64',
		folder: 'cli-darwin-arm64',
		os: 'darwin',
		cpu: 'arm64',
	},
	{
		target: 'bun-darwin-x64',
		folder: 'cli-darwin-x64',
		os: 'darwin',
		cpu: 'x64',
	},
	// Windows
	{
		target: 'bun-windows-x64',
		folder: 'cli-windows-x64',
		os: 'win32',
		cpu: 'x64',
	},
] as const;

await Promise.all(targets.map(async ({
	target, folder, os, cpu,
}) => {
	const version = (cliPackageJson.optionalDependencies[`@package-pal/${folder}`] as string | undefined) ?? cliPackageJson.version;
	const dirPath = join(outDir, folder);
	const binDirPath = join(dirPath, 'bin');
	const ext = target.startsWith('bun-windows') ? '.exe' : '';
	const filename = name + ext;
	const binOutPath = join(binDirPath, filename);
	const packagePath = join(dirPath, 'package.json');

	rmSync(dirPath, {
		recursive: true,
		force: true,
	});
	mkdirSync(binDirPath, { recursive: true });

	console.log(`Building ${target} → ${binOutPath}.`);
	const buildExecutable = $`bun build ${entry} --compile --target=${target} --outfile=${binOutPath} --minify --sourcemap --bytecode`;

	const packageContent = {
		name: `@package-pal/${folder}`,
		version,
		description: `PackagePal CLI for ${os} ${cpu}.`,
		license,
		os: [os],
		cpu: [cpu],
		files: [`bin/${filename}`],
		sideEffects: false,
		bunVersion,
	};

	console.log(`Writing ${packagePath}.`);
	const writePackage = writeFile(packagePath, JSON.stringify(
		packageContent, null, 2,
	));

	await Promise.all([buildExecutable, writePackage]);
	await chmod(binOutPath, 0o755);
}));
