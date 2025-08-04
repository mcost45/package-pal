import type { ValueOf } from '@package-pal/util';

export const ChangeAction = {
	Ignore: 'Ignore',
	Partial: 'Partial',
	Restart: 'Restart',
} as const;

export type ChangeAction = ValueOf<typeof ChangeAction>;
