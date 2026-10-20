/* eslint import-x/extensions: 0 */
import {
	mkdtempSync, rmSync,
} from 'fs';
import {
	join, resolve, sep,
} from 'path';
import {
	expect, test,
} from 'bun:test';
import { readPackagePalConfig } from '../src/lib/api';

test('Delivers logs through the configured logger with its instance state intact', async () => {
	const root = mkdtempSync(join(import.meta.dirname, 'temp-config-'));
	if (!resolve(root).startsWith(resolve(import.meta.dirname) + sep)) throw new Error('Unexpected fixture path');
	const path = join(root, 'ppal.config.ts');
	await Bun.write(path, `
export const messages = [];
class Logger {
  prefix = 'custom';
  debug() {}
  info(message) { messages.push(this.prefix + ':' + message); }
  warn() {}
  error() {}
}
export default { logLevel: 'silent', logger: new Logger() };
`);
	try {
		const { config } = await readPackagePalConfig({ overrideConfigPath: path });
		config.logger.info('message');
		const { messages } = await import(path) as { messages: string[] };
		expect(messages).toEqual(['custom:message']);
	} finally {
		rmSync(root, {
			recursive: true,
			force: true,
		});
	}
});
