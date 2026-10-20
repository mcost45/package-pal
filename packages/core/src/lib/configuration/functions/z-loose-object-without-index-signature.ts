import * as z from 'zod/mini';
import type * as core from 'zod/v4/core';

type EmptyZodShape = Record<string, never>;

export const zLooseObjectWithoutIndexSignature = <T extends core.$ZodLooseShape = EmptyZodShape>(
	shape: T,
	params?: string | core.$ZodObjectParams,
): z.ZodMiniObject<T> => {
	return z.looseObject(shape, params);
};
