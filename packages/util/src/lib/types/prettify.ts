export type Prettify<T, Deep extends boolean = false> = {
	[K in keyof T]: Deep extends true ? Prettify<T[K]> : T[K];
} & {};
