/* eslint import-x/extensions: 0 */
import {
	describe, it, expect,
} from 'bun:test';
import { escapeShellArg } from '../lib/functions/escape-shell-arg';
import { Shell } from '../lib/types/shell';

describe('escapeShellArg', () => {
	describe('cmd', () => {
		const shell = Shell.cmd;

		it('should wrap a simple string in double quotes', () => {
			expect(escapeShellArg('simple', shell)).toBe('"simple"');
		});

		it('should escape shell metacharacters', () => {
			expect(escapeShellArg('a&b|c<d>e(f)g', shell)).toBe('"a^&b^|c^<d^>e^(f^)g"');
		});

		it('should escape carets', () => {
			expect(escapeShellArg('a^b', shell)).toBe('"a^^^^b"');
		});

		it('should escape exclamation marks for delayed expansion', () => {
			expect(escapeShellArg('a!b', shell)).toBe('"a^^!b"');
		});

		it('should double percentages to escape them', () => {
			expect(escapeShellArg('%PATH%', shell)).toBe('"%%%%PATH%%%%"');
		});

		it('should handle a combination of special characters', () => {
			expect(escapeShellArg('v^1.0.0 & %VAR%!', shell)).toBe('"v^^^^1.0.0 ^& %%%%VAR%%%%^^!"');
		});

		it('should handle an empty string', () => {
			expect(escapeShellArg('', shell)).toBe('""');
		});

		it('should handle leading and trailing whitespace', () => {
			expect(escapeShellArg('  spaced  ', shell)).toBe('"  spaced  "');
		});

		it('should handle multiple percent signs mixed with other meta characters', () => {
			expect(escapeShellArg('%PATH% & %USER% ^ !', shell)).toBe('"%%%%PATH%%%% ^& %%%%USER%%%% ^^^^ ^^!"');
		});
	});

	describe('powershell/pwsh', () => {
		const shells = [Shell.powershell, Shell.pwsh];

		for (const shell of shells) {
			describe(shell, () => {
				it('should wrap a simple string in single quotes', () => {
					expect(escapeShellArg('simple', shell)).toBe('\'simple\'');
				});

				it('should escape single quotes by doubling them', () => {
					expect(escapeShellArg('it\'s a test', shell)).toBe('\'it\'\'s a test\'');
				});

				it('should handle a string with no special characters', () => {
					expect(escapeShellArg('hello world', shell)).toBe('\'hello world\'');
				});

				it('should handle an empty string', () => {
					expect(escapeShellArg('', shell)).toBe('\'\'');
				});

				it('should handle a string with only single quotes', () => {
					expect(escapeShellArg('\'\'\'', shell)).toBe('\'\'\'\'\'\'\'\'');
				});

				it('should handle strings with dollar signs', () => {
					expect(escapeShellArg('$Env:USER', shell)).toBe('\'$Env:USER\'');
				});

				it('should handle strings with backslashes', () => {
					expect(escapeShellArg('C:\\Program Files\\', shell)).toBe('\'C:\\Program Files\\\'');
				});

				it('should handle mixed quotes', () => {
					expect(escapeShellArg('She said "don\'t"', shell)).toBe('\'She said "don\'\'t"\'');
				});

				it('should handle leading and trailing whitespace', () => {
					expect(escapeShellArg('  spaced  ', shell)).toBe('\'  spaced  \'');
				});
			});
		}
	});

	describe('posix shells (sh, bash, zsh, fish)', () => {
		const shells = [
			Shell.sh,
			Shell.bash,
			Shell.zsh,
			Shell.fish,
		];

		for (const shell of shells) {
			describe(shell, () => {
				it('should wrap a simple string in single quotes', () => {
					expect(escapeShellArg('simple', shell)).toBe('\'simple\'');
				});

				it('should escape single quotes', () => {
					expect(escapeShellArg('don\'t you know', shell)).toBe('\'don\'\\\'\'t you know\'');
				});

				it('should handle a string with no special characters', () => {
					expect(escapeShellArg('hello world', shell)).toBe('\'hello world\'');
				});

				it('should handle an empty string', () => {
					expect(escapeShellArg('', shell)).toBe('\'\'');
				});

				it('should handle multiple single quotes', () => {
					expect(escapeShellArg('a\'b\'c', shell)).toBe('\'a\'\\\'\'b\'\\\'\'c\'');
				});

				it('should handle strings with dollar signs', () => {
					expect(escapeShellArg('$HOME/$USER', shell)).toBe('\'$HOME/$USER\'');
				});

				it('should handle strings with backslashes', () => {
					expect(escapeShellArg('C:\\Program Files\\', shell)).toBe('\'C:\\Program Files\\\'');
				});

				it('should handle mixed quotes', () => {
					expect(escapeShellArg('She said "don\'t"', shell)).toBe('\'She said "don\'\\\'\'t"\'');
				});

				it('should handle leading and trailing whitespace', () => {
					expect(escapeShellArg('  spaced  ', shell)).toBe('\'  spaced  \'');
				});
			});
		}
	});

	describe('default shell handling', () => {
		it('should use posix escaping for an unknown shell', () => {
			// @ts-expect-error Testing untyped usage
			expect(escapeShellArg('it\'s a test', 'unknown_shell')).toBe('\'it\'\\\'\'s a test\'');
		});
	});
});
