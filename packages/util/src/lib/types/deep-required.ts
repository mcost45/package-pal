import type { BuiltIn } from './built-in.ts';

export type DeepRequired<T> = T extends BuiltIn
	? Exclude<T, undefined>
	: {
			[K in keyof T]-?: DeepRequired<T[K]>
		};
