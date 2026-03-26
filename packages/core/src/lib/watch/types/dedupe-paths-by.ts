import type { ValueOf } from '@package-pal/util';

export const DedupePathsBy = {
	Parent: 'parent',
	Child: 'child',
} as const;

export type DedupePathsBy = ValueOf<typeof DedupePathsBy>;
