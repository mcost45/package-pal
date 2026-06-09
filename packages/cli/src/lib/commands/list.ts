import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags { reverse?: boolean }

export const list = buildCommand({
	loader: () => import('./functions/do-list.ts'),
	parameters: {
		flags: {
			...commonParameters.flags,
			reverse: {
				kind: 'boolean',
				brief: 'Reverse order (list dependencies instead of dependents)',
				optional: true,
			},
		},
		positional: {
			kind: 'tuple',
			parameters: [{
				placeholder: 'package',
				brief: 'Package name to show (filter) the graph for',
				parse: String,
				optional: true,
			}],
		},
	},
	docs: { brief: 'Print dependency graph with a tree structure' },
});
