import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags {
	concurrency?: number;
	topological: boolean;
}

export const forEach = buildCommand({
	loader: () => import('./functions/do-for-each.ts'),
	parameters: {
		flags: {
			...commonParameters.flags,
			concurrency: {
				kind: 'parsed',
				parse: Number,
				brief: 'Limits concurrency of parallel commands',
				optional: true,
			},
			topological: {
				kind: 'boolean',
				brief: 'Run in topological order',
				default: true,
			},
		},
		positional: {
			kind: 'tuple',
			parameters: [{
				placeholder: 'cmd',
				brief: 'Command',
				parse: String,
			}],
		},
	},
	docs: { brief: 'Run a command for each package, with special placeholders {name} (package name), {dir} (package dir name) available' },
});
