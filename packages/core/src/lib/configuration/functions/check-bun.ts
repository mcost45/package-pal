export const checkBun = () => {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (!Bun) {
		throw new Error('This package must be run with the Bun runtime.');
	}
};
