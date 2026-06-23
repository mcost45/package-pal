import {
	BumpVersionType, type BumpVersionType as BumpVersionTypeValue,
} from '@package-pal/core';
import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags {
	preid?: string;
	exact?: boolean;
	cascade?: BumpVersionTypeValue;
}

const parseBumpVersionType = (value: string): BumpVersionTypeValue => {
	if (Object.values(BumpVersionType).includes(value as BumpVersionTypeValue)) {
		return value as BumpVersionTypeValue;
	}

	throw new Error(`Invalid bump version type '${value}'. Expected one of: ${Object.values(BumpVersionType).join(', ')}.`);
};

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
				brief: 'If true, all dependencies will be bumped to the new version exactly (no ranges or wildcards)',
				optional: true,
			},
			cascade: {
				kind: 'parsed',
				placeholder: 'bump version',
				brief: 'Cascades the bump down to dependents with the specified bump version type',
				parse: parseBumpVersionType,
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
				placeholder: 'bump version',
				brief: 'Bump version type',
				parse: parseBumpVersionType,
				optional: true,
			}],
		},
	},
	docs: { brief: 'Bumps the source package version and updates any dependents if the new version is no longer semver-compatible, preserving original version prefixes (e.g., `^`, `~`) - optionally cascade bump dependent package versions - does not publish' },
});
