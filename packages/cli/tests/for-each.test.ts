import { resolve } from 'path';
import {
	expect, test,
} from 'bun:test';

test('Rejects malformed concurrency with an actionable CLI error', async () => {
	const child = Bun.spawn([
		process.execPath,
		resolve(import.meta.dirname, '../src/index.ts'),
		'for-each',
		'--concurrency',
		'abc',
		'echo SHOULD_NOT_RUN',
	], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
	expect(code).not.toBe(0);
	expect(stderr).toContain('Concurrency must be a positive integer.');
});
