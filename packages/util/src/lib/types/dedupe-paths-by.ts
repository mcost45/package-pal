import type { ValueOf } from './value-of.ts';

export const DedupePathsBy = {
	Parent: 'parent',
	Child: 'child',
} as const;

export type DedupePathsBy = ValueOf<typeof DedupePathsBy>;
