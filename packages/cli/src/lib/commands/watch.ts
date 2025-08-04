import { buildCommand } from '@stricli/core';

export interface Flags { config?: string }

export const watch = buildCommand({
	loader: () => import('../functions/watch.ts'),
	parameters: { flags: { config: {
		kind: 'parsed',
		parse: String,
		brief: 'Override config file path',
		optional: true,
	} } },
	docs: { brief: 'Watches package source file changes, and triggers respective hooks defined in config' },
});
