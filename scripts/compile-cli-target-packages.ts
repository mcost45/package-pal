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

const entry = './packages/cli/src/index.ts';
const outDir = './dist';
const name = assertDefined(Object.keys(cliPackageJson.bin)[0]);
const license = cliPackageJson.license;

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

for (const {
	target, folder, os, cpu,
} of targets) {
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
	};

	console.log(`Writing ${packagePath}.`);
	const writePackage = writeFile(packagePath, JSON.stringify(
		packageContent, null, 2,
	));

	await Promise.all([buildExecutable, writePackage]);
	await chmod(binOutPath, 0o755);
}
