import { z } from 'zod/mini';

export const zLooseFunction = (): z.ZodMiniType<Function> => {
	return z.transform((arg: unknown, ctx) => {
		if (typeof arg !== 'function') {
			ctx.issues.push({
				message: 'Expected a function',
				code: 'custom',
				input: arg,
			});
			return z.NEVER;
		}

		return arg;
	});
};
