import type { ValueOf } from '@package-pal/util';

export const RunAsyncType = {
	Sequential: 'Sequential',
	Parallel: 'Parallel',
} as const;

export type RunAsyncType = ValueOf<typeof RunAsyncType>;
