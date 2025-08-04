import * as z from 'zod/mini';
import type * as core from 'zod/v4/core';

export const zLooseObjectWithoutIndexSignature = <T extends core.$ZodLooseShape = Record<never, core.SomeType>>(
	shape: T,
	params?: string | core.$ZodObjectParams,
): z.ZodMiniObject<T> => {
	return z.looseObject(shape, params);
};
