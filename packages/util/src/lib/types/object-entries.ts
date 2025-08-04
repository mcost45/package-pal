export type ObjectEntries<T> = T extends Map<infer K extends PropertyKey, infer V> ? ObjectEntries<Record<K, V>> : {
	[K in keyof T]: [K, T[K]];
}[keyof T][];
