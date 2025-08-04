import type { ValueOf } from '@package-pal/util';

export const BumpVersionType = {
	Major: 'major',
	Minor: 'minor',
	Patch: 'patch',
	Premajor: 'premajor',
	Preminor: 'preminor',
	Prepatch: 'prepatch',
	Prerelease: 'prerelease',
} as const;

export type BumpVersionType = ValueOf<typeof BumpVersionType>;
