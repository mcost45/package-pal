import { isDefined } from './is-defined.ts';

export const assertDefined = <T>(value: T): NonNullable<T> => {
	if (!isDefined(value)) {
		throw new Error(`Expected ${String(value)} to be defined.`);
	}

	return value;
};
