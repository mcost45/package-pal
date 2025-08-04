import type { BuiltIn } from './built-in.ts';

export type DeepFilterDefined<T> = T extends BuiltIn ? Exclude<T, undefined | null>
	: {
			[K in keyof T as Exclude<T[K], undefined | null> extends never ? never : K]-?:
			DeepFilterDefined<T[K]>
		};
