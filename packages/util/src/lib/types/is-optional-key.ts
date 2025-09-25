export type IsOptionalKey<T, K extends keyof T>
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	= {} extends Pick<T, K> ? true : false;
