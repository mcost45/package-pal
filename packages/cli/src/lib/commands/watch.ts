import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from '../common-parameters.ts';

export type Flags = CommonFlags;

export const watch = buildCommand({
	loader: () => import('../functions/watch.ts'),
	parameters: commonParameters,
	docs: { brief: 'Watches package source file changes, and triggers respective hooks defined in config' },
});
