export type BuiltIn
	= | Function
		| Date
		| Error
		| RegExp
		| Map<unknown, unknown>
		| Set<unknown>
		| WeakMap<WeakKey, unknown>
		| WeakSet<WeakKey>
		| unknown[]
		| Promise<unknown>;
