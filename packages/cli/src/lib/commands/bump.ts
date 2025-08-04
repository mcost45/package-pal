import { buildCommand } from '@stricli/core';

export interface Flags {
	name: string;
	config?: string;
}

export const bump = buildCommand({
	loader: () => import('../functions/bump.ts'),
	parameters: { flags: {
		name: {
			kind: 'parsed',
			parse: String,
			brief: 'Package name',
		},
		config: {
			kind: 'parsed',
			parse: String,
			brief: 'Override config file path',
			optional: true,
		},
	} },
	docs: { brief: 'Bumps the source package version and updates any dependents if the new version is no longer semver-compatible, preserving original version prefixes (e.g., `^`, `~`)' },
});
