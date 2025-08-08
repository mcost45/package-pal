import type { ValueOf } from './value-of.ts';

export const RunAsyncType = {
	Sequential: 'Sequential',
	Parallel: 'Parallel',
} as const;

export type RunAsyncType = ValueOf<typeof RunAsyncType>;
