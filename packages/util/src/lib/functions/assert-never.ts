export const assertNever = (debug?: unknown): never => {
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	throw new Error(`Reached unexpected line${debug !== undefined ? `: '${String(debug)}'` : ''}`);
};
