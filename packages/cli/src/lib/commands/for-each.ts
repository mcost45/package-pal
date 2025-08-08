import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags {
	parallel: boolean;
	topological: boolean;
}

export const forEach = buildCommand({
	loader: () => import('./functions/do-for-each.ts'),
	parameters: {
		flags: {
			...commonParameters.flags,
			parallel: {
				kind: 'boolean',
				brief: 'Run in parallel when possible',
				default: true,
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
