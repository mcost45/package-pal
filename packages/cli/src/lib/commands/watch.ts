import { buildCommand } from '@stricli/core';
import {
	type CommonFlags, commonParameters,
} from './common.ts';

export type Flags = CommonFlags;

export const watch = buildCommand({
	loader: () => import('./functions/do-watch.ts'),
	parameters: commonParameters,
	docs: { brief: 'Watches package source file changes, and triggers respective hooks defined in config' },
});
