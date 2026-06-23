import type { ValueOf } from '@package-pal/util';

export const BumpVersionType = {
	Patch: 'patch',
	Minor: 'minor',
	Major: 'major',
	Prepatch: 'prepatch',
	Preminor: 'preminor',
	Premajor: 'premajor',
	Prerelease: 'prerelease',
} as const;

export type BumpVersionType = ValueOf<typeof BumpVersionType>;
