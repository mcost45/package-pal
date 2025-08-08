import type { ValueOf } from '@package-pal/util';

export const ExitState = {
	Completed: 'Completed',
	Errored: 'Errored',
	Cancelled: 'Cancelled',
} as const;

export type ExitState = ValueOf<typeof ExitState>;
