import { isDefined } from './is-defined.ts';

const maxStringifyLen = 50;

export const formatUnknownError = (error: unknown) => {
	if (!isDefined(error)) {
		return (String(error));
	}

	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}

	if (typeof error === 'object') {
		try {
			const message = JSON.stringify(
				error, null, 2,
			);

			if (message.length <= maxStringifyLen) {
				return message;
			}

			return `${message.substring(0, maxStringifyLen)}...`;
		} catch {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			return String(error);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(error);
};
