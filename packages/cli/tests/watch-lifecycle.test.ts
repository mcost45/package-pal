import {
	mkdtempSync, rmSync,
} from 'fs';
import {
	join, resolve, sep,
} from 'path';
import {
	expect, test,
} from 'bun:test';

test.each([
	'onBeforeProcessPackage',
	'onProcessPackage',
	'onBeforePackagesReady',
])(
	'Recovers after a failed %s without reporting readiness', async (failingHook) => {
		const root = mkdtempSync(join(import.meta.dirname, 'temp-watch-'));
		if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
		await Bun.write(join(root, 'pkg/package.json'), JSON.stringify({
			name: 'pkg',
			version: '1.0.0',
		}));
		await Bun.write(join(root, 'ppal.config.ts'), `
let fail = true;
const hook = (name, props) => {
  if (!props.totalChanges.size) return;
  if (name === ${JSON.stringify(failingHook)} && fail) { fail = false; return 'exit 1'; }
  console.log('HOOK:' + name);
};
export default {
  adapter: 'package-json', packages: 'pkg',
  watch: { debounceMs: 20, hooks: {
    onBeforeProcessPackage: props => hook('onBeforeProcessPackage', props),
    onProcessPackage: props => hook('onProcessPackage', props),
    onAfterProcessPackage: props => hook('onAfterProcessPackage', props),
    onBeforePackagesReady: props => hook('onBeforePackagesReady', props),
    onPackagesReady: props => props.totalChanges.size ? hook('onPackagesReady', props) : console.log('INITIAL_READY'),
    onAfterPackagesReady: props => hook('onAfterPackagesReady', props),
  } },
};`);
		const child = Bun.spawn([
			process.execPath,
			resolve(import.meta.dirname, '../src/index.ts'),
			'watch',
		], {
			cwd: root,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		let output = '';
		const read = async (stream: ReadableStream<Uint8Array>) => {
			const decoder = new TextDecoder();
			for await (const chunk of stream) output += decoder.decode(chunk, { stream: true });
		};
		const readers = Promise.all([read(child.stdout), read(child.stderr)]);
		const waitFor = async (pattern: RegExp) => {
			const deadline = Date.now() + 10000;
			while (!pattern.test(output)) {
				if (Date.now() > deadline) throw new Error(`Watch output timed out:\n${output}`);
				await Bun.sleep(10);
			}
		};
		try {
			await waitFor(/INITIAL_READY/);
			await Bun.write(join(root, 'pkg/source.ts'), 'first change');
			await waitFor(/Processing (?:completed|failed|cancelled)[^.]*\./);
			expect(output).toContain('Processing failed.');
			if (failingHook === 'onBeforeProcessPackage') expect(output).not.toContain('HOOK:onProcessPackage');
			if (failingHook !== 'onBeforePackagesReady') expect(output).not.toContain('HOOK:onAfterProcessPackage');
			expect(output).not.toContain('HOOK:onPackagesReady');
			expect(output).not.toContain('HOOK:onAfterPackagesReady');

			await Bun.write(join(root, 'pkg/source.ts'), 'second change');
			await waitFor(/HOOK:onAfterPackagesReady/);
			expect(output).toContain('HOOK:onProcessPackage');
			expect(output).toContain('HOOK:onAfterProcessPackage');
			expect(output).toContain('HOOK:onPackagesReady');
		} finally {
			child.kill();
			await child.exited;
			await readers;
			rmSync(root, {
				recursive: true,
				force: true,
			});
		}
	}, 20000,
);
