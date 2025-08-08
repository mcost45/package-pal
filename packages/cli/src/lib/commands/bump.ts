import type { BumpVersionType } from '@package-pal/core';
import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags {
	preid?: string;
	exact?: boolean;
}

export const bump = buildCommand({
	loader: () => import('./functions/do-bump.ts'),
	parameters: {
		flags: {
			...commonParameters.flags,
			preid: {
				kind: 'parsed',
				parse: String,
				brief: 'Pre-release identifier to use when bumping versions',
				optional: true,
			},
			exact: {
				kind: 'boolean',
				brief: 'If true, all dependencies will be bumped to the new version exactly',
				optional: true,
			},
		},
		positional: {
			kind: 'tuple',
			parameters: [{
				placeholder: 'package',
				brief: 'Package name',
				parse: String,
				optional: true,
			}, {
				placeholder: 'new-version',
				brief: 'Bump version type',
				parse: (value: string) => value as BumpVersionType,
				optional: true,
			}],
		},
	},
	docs: { brief: 'Bumps the source package version and updates any dependents if the new version is no longer semver-compatible, preserving original version prefixes (e.g., `^`, `~`)' },
});
