export const arraysEqual = <T>(
	a: T[] | readonly T[] | null | undefined,
	b: T[] | readonly T[] | null | undefined,
) => {
	if (a === b) {
		return true;
	}

	if (!a || !b) {
		return false;
	}

	if (a.length !== b.length) {
		return false;
	}

	for (let i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) {
			return false;
		}
	}

	return true;
};
