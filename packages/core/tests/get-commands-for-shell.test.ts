/* eslint import-x/extensions: 0 */
import {
	expect, test, describe, mock, beforeAll,
} from 'bun:test';
import { getCommandsForShell } from '../src/lib/process/functions/get-commands-for-shell';
import { Shell } from '../src/lib/types/shell';

let mockedShell: Shell = Shell.sh;

// Mock the get-shell module so we can test getCommandsForShell behavior for all shells
await mock.module('../src/lib/process/functions/get-shell', () => {
	return { getShell: () => mockedShell };
});

describe('getCommandsForShell', () => {
	describe('POSIX shells (bash, zsh, fish, sh)', () => {
		test('should format correctly for bash', () => {
			mockedShell = Shell.bash;
			const result = getCommandsForShell('echo "Hello"');
			expect(result.commands).toEqual([
				'bash',
				'-c',
				'echo "Hello"',
			]);
			expect(result.stderrProcessor('test')).toBe('test');
		});

		test('should format correctly for zsh', () => {
			mockedShell = Shell.zsh;
			const result = getCommandsForShell('echo "Hello"');
			expect(result.commands).toEqual([
				'zsh',
				'-c',
				'echo "Hello"',
			]);
		});

		test('should format correctly for sh', () => {
			mockedShell = Shell.sh;
			const result = getCommandsForShell('echo "Hello"');
			expect(result.commands).toEqual([
				'sh',
				'-c',
				'echo "Hello"',
			]);
		});
	});

	describe('Windows cmd', () => {
		test('should format correctly for cmd.exe', () => {
			mockedShell = Shell.cmd;
			const result = getCommandsForShell('echo Hello');
			expect(result.commands).toEqual([
				'cmd',
				'/c',
				'echo Hello',
			]);
			expect(result.stderrProcessor('test')).toBe('test');
		});
	});

	describe('PowerShell (pwsh, powershell)', () => {
		beforeAll(() => {
			mockedShell = Shell.pwsh;
		});

		test('should UTF-16LE base64 encode a plain command', () => {
			const command = 'Write-Output "Hello"';
			const result = getCommandsForShell(command);

			const expectedBase64 = Buffer.from(command, 'utf16le').toString('base64');
			expect(result.commands).toEqual([
				'pwsh',
				'-EncodedCommand',
				expectedBase64,
			]);
			expect(result.stderrProcessor).toBeDefined();
		});

		test('should extract top-level flags and encode the remaining command', () => {
			const command = '-NoProfile -ExecutionPolicy Bypass Write-Output "Hello"';
			const result = getCommandsForShell(command);

			const expectedBase64 = Buffer.from('Write-Output "Hello"', 'utf16le').toString('base64');
			expect(result.commands).toEqual([
				'pwsh',
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-EncodedCommand',
				expectedBase64,
			]);
		});

		test('should handle pre-encoded commands by spreading flags instead of returning a single argument string', () => {
			const command = '-NoProfile -ExecutionPolicy Bypass -EncodedCommand BASE64TEXT';
			const result = getCommandsForShell(command);

			// Our fix: should spread the arguments properly into the commands array
			expect(result.commands).toEqual([
				'pwsh',
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-EncodedCommand',
				'BASE64TEXT',
			]);
		});

		test('should NOT treat -EncodedCommand as pre-encoded if it is part of the command', () => {
			const command = 'Write-Output "my -EncodedCommand string"';
			const result = getCommandsForShell(command);

			const expectedBase64 = Buffer.from(command, 'utf16le').toString('base64');
			expect(result.commands).toEqual([
				'pwsh',
				'-EncodedCommand',
				expectedBase64,
			]);
		});
	});
});
