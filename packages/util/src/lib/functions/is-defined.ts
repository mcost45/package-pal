export const isDefined: <T>(value: T) => value is NonNullable<T> = (value) => {
	return value !== undefined && value !== null;
};
