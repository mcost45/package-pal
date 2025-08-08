import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export interface Flags extends CommonFlags { noError?: boolean }

export const checkCircular = buildCommand({
	loader: () => import('./functions/do-check-circular.ts'),
	parameters: { flags: {
		...commonParameters.flags,
		noError: {
			kind: 'boolean',
			brief: 'Override config file path',
			optional: true,
		},
	} },
	docs: { brief: 'Checks for circular dependencies' },
});
