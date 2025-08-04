import type { ValueOf } from '@package-pal/util';

export const StdType = {
	Out: 'Out',
	Err: 'Err',
} as const;

export type StdType = ValueOf<typeof StdType>;
