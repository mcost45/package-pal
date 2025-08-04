import type { ValueOf } from '@package-pal/util';

export const SupportedConfigType = {
	TS: 'ts',
	CTS: 'cts',
	MTS: 'mts',
	JS: 'js',
	CJS: 'cjs',
	MJS: 'mjs',
} as const;

export type SupportedConfigType = ValueOf<typeof SupportedConfigType>;
