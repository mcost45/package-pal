import type { ValueOf } from '@package-pal/util';

export const DependenciesField = {
	Dependencies: 'dependencies',
	DevDependencies: 'devDependencies',
	PeerDependencies: 'peerDependencies',
	OptionalDependencies: 'optionalDependencies',
} as const;

export type DependenciesField = ValueOf<typeof DependenciesField>;
