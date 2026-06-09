import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags { error?: boolean }

export const checkCircular = buildCommand({
	loader: () => import('./functions/do-check-circular.ts'),
	parameters: { flags: {
		...commonParameters.flags,
		error: {
			kind: 'boolean',
			brief: 'If set, will exit with an error when circular dependencies are found',
			optional: true,
		},
	} },
	docs: { brief: 'Checks for circular dependencies' },
});
