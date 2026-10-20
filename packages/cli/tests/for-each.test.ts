import {
	mkdtempSync, rmSync,
} from 'fs';
import {
	join, resolve, sep,
} from 'path';
import {
	afterAll, beforeAll, expect, test,
} from 'bun:test';

const root = mkdtempSync(join(import.meta.dirname, 'temp-for-each-'));
if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
beforeAll(async () => {
	await Bun.write(join(root, 'ppal.config.json'), JSON.stringify({
		adapter: 'package-json',
		packages: 'pkg',
	}));
	await Bun.write(join(root, 'pkg/package.json'), JSON.stringify({
		name: 'pkg',
		version: '1.0.0',
	}));
});
afterAll(() => {
	rmSync(root, {
		recursive: true,
		force: true,
	});
});

test('Rejects malformed concurrency with an actionable CLI error', async () => {
	const child = Bun.spawn([
		process.execPath,
		resolve(import.meta.dirname, '../src/index.ts'),
		'for-each',
		'--concurrency',
		'abc',
		'echo SHOULD_NOT_RUN',
	], {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
	expect(code).not.toBe(0);
	expect(stderr).toContain('Concurrency must be a positive integer.');
});

test.each([
	130,
	137,
	143,
])('Reports command exit %s as a CLI failure', async (exitCode) => {
	const child = Bun.spawn([
		process.execPath,
		resolve(import.meta.dirname, '../src/index.ts'),
		'for-each',
		`exit ${exitCode.toString()}`,
	], {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
	expect(code).not.toBe(0);
	expect(stderr).toContain(`failed with exit code ${exitCode.toString()}`);
});
