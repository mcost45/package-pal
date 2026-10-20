import { EventEmitter } from 'events';
import {
	mkdtempSync, mkdirSync, rmSync,
} from 'fs';
import type {
	ClientRequest, IncomingMessage,
} from 'http';
import * as https from 'https';
import {
	join, resolve, sep,
} from 'path';
import { PassThrough } from 'stream';
import {
	expect, spyOn, test,
} from 'bun:test';
import { c } from 'tar';
import { prepareBinary } from '../src/lib/install/functions/prepare-binary.js';

test('Installs a missing binary at the path used by the launcher', async () => {
	const root = mkdtempSync(join(import.meta.dirname, 'temp-install-'));
	if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
	const archive = join(root, 'binary.tgz');
	const contents = 'binary fixture';
	const source = join(root, 'source');
	const output = join(root, 'bin');
	mkdirSync(join(source, 'package/bin'), { recursive: true });
	await Bun.write(join(source, 'package/bin/ppal.exe'), contents);
	await c({
		cwd: source,
		file: archive,
		gzip: true,
	}, ['package/bin/ppal.exe']);
	const body = Buffer.from(await Bun.file(archive).arrayBuffer());
	const request = spyOn(https, 'get').mockImplementation((_url, callback) => {
		const response = new PassThrough();
		const incoming = Object.assign(response, { statusCode: 200 }) as unknown as IncomingMessage;
		(callback as (response: IncomingMessage) => void)(incoming);
		response.end(body);
		return new EventEmitter() as ClientRequest;
	});
	try {
		await prepareBinary({
			platform: 'win32',
			binExecutableName: 'ppal.exe',
			targetPackage: 'cli-windows-x64',
			targetVersion: null,
			targetBinPath: null,
			outputBinDir: output,
			outputBinBasePath: join(output, 'ppal'),
			outputBinPath: join(output, 'ppal.exe'),
		});
		expect(await Bun.file(join(output, 'source/bin/ppal.exe')).text()).toBe(contents);
	} finally {
		request.mockRestore();
		rmSync(root, {
			recursive: true,
			force: true,
		});
	}
});
