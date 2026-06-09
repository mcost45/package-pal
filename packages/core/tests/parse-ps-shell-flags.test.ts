/* eslint import-x/extensions: 0 */
import {
	expect, test, describe,
} from 'bun:test';
import { parsePsShellFlags } from '../src/lib/process/functions/parse-ps-shell-flags';

describe('parsePsShellFlags', () => {
	test('should preserve newlines and whitespace in the command', () => {
		const input = 'Write-Host \'Line 1\'\nWrite-Host \'Line 2\'';
		const result = parsePsShellFlags(input);

		expect(result.command).toBe('Write-Host \'Line 1\'\nWrite-Host \'Line 2\'');
		expect(result.flags.size).toBe(0);
	});

	test('should extract shell flags and preserve the remaining command formatting', () => {
		const input = '-NoProfile -ExecutionPolicy Bypass Write-Host \'Hello\'\n  Write-Host \'World\'';
		const result = parsePsShellFlags(input);

		expect(Array.from(result.flags)).toEqual([
			'-NoProfile',
			'-ExecutionPolicy',
			'Bypass',
		]);
		expect(result.command).toBe('Write-Host \'Hello\'\n  Write-Host \'World\'');
	});

	test('should handle commands starting with quotes', () => {
		const input = '"C:\\Path With Spaces\\app.exe" --arg';
		const result = parsePsShellFlags(input);

		expect(result.command).toBe('"C:\\Path With Spaces\\app.exe" --arg');
		expect(result.flags.size).toBe(0);
	});

	test('should handle empty input', () => {
		const result = parsePsShellFlags('');
		expect(result.command).toBe('');
		expect(result.flags.size).toBe(0);
	});

	test('should identify pre-encoded commands', () => {
		const input = '-EncodedCommand BASE64TEXT';
		const result = parsePsShellFlags(input);

		expect(result.isPreEncoded).toBe(true);
		expect(Array.from(result.flags)).toContain('-EncodedCommand');
	});

	test('should identify pre-encoded commands case-insensitively', () => {
		const input = '-encodedcommand BASE64TEXT';
		const result = parsePsShellFlags(input);

		expect(result.isPreEncoded).toBe(true);
		expect(Array.from(result.flags)).toContain('-encodedcommand');
	});

	test('should NOT identify pre-encoded command if -encodedcommand appears within the command itself', () => {
		const input = 'Write-Output "We use the -EncodedCommand flag in our build script"';
		const result = parsePsShellFlags(input);

		expect(result.isPreEncoded).toBe(false);
		expect(result.flags.size).toBe(0);
		expect(result.command).toBe('Write-Output "We use the -EncodedCommand flag in our build script"');
	});

	test('should NOT identify pre-encoded command if -encodedcommand is part of a file path', () => {
		const input = 'C:\\projects\\my-encodedcommand-test\\run.ps1';
		const result = parsePsShellFlags(input);

		expect(result.isPreEncoded).toBe(false);
		expect(result.flags.size).toBe(0);
		expect(result.command).toBe('C:\\projects\\my-encodedcommand-test\\run.ps1');
	});
});
