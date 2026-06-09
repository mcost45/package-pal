/* eslint import-x/extensions: 0 */
import {
	describe, it, expect,
} from 'bun:test';
import { getShell } from '../src/lib/process/functions/get-shell';
import { runSubprocess } from '../src/lib/process/functions/run-subprocess';
import { Shell } from '../src/lib/types/shell';

describe('runSubprocess env support', () => {
	it('should execute command with custom environment variables', async () => {
		const shell = getShell();
		let command: string;

		switch (shell) {
			case Shell.cmd:
				command = 'echo %MY_TEST_VAR%';
				break;

			case Shell.pwsh:
			case Shell.powershell:
				command = 'Write-Output $env:MY_TEST_VAR';
				break;

			default:
				command = 'echo $MY_TEST_VAR';
		}

		let capturedOutput = '';
		await runSubprocess({
			debugName: 'test-env',
			shellCommand: command,
			env: { MY_TEST_VAR: 'HelloSubprocessEnv' },
			onStdChunk: (chunk) => {
				capturedOutput += chunk;
			},
		});

		expect(capturedOutput.trim()).toContain('HelloSubprocessEnv');
	});
});
