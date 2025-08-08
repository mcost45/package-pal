import type { ValueOf } from './value-of.ts';

export const Shell = {
	sh: 'sh',
	bash: 'bash',
	zsh: 'zsh',
	pwsh: 'pwsh',
	fish: 'fish',
	powershell: 'powershell',
	cmd: 'cmd',
} as const;

export type Shell = ValueOf<typeof Shell>;
