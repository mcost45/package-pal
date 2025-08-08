import type { SubprocessCallback } from '../configuration/types/subprocess-callback.ts';

export type ForEachCommandCallback = SubprocessCallback<{
	name: string;
	dir: string;
}>;
