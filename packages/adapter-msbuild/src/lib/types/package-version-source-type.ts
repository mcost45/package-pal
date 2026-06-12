import type { ValueOf } from '@package-pal/util';

export const PackageVersionSourceType = {
	Property: 0,
	CpmLiteral: 1,
} as const;

export type PackageVersionSourceType = ValueOf<typeof PackageVersionSourceType>;
