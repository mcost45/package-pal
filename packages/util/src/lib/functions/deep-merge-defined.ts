import type { DeepFilterDefined } from '../types/deep-filter-defined.ts';
import { assertDefined } from './assert-defined.ts';
import { isDefined } from './is-defined.ts';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	return (
		typeof value === 'object'
		&& value !== null
		&& !Array.isArray(value)
		&& Object.prototype.toString.call(value) === '[object Object]'
	);
};

export const deepMergeDefined = <A extends object, B extends object>(a: A, b: B): A & DeepFilterDefined<B> => {
	a = { ...a };
	b = { ...b };
	const result = a as object;
	const stack: {
		target: object;
		source: object;
	}[] = [{
		target: result,
		source: b,
	}];

	while (stack.length) {
		const {
			target, source,
		} = assertDefined(stack.pop());

		for (const key in source) {
			if (!Object.prototype.hasOwnProperty.call(source, key)) {
				continue;
			}

			const sourceVal = source[key as keyof typeof source];
			const targetVal = target[key as keyof typeof target];

			if (!isDefined(sourceVal)) {
				continue;
			}

			if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
				// @ts-expect-error Setup next iteration
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				target[key as keyof typeof target] ??= {};
				stack.push({
					target: target[key as keyof typeof target],
					source: sourceVal,
				});
			} else {
				target[key as keyof typeof target] = sourceVal;
			}
		}
	}

	return result as A & DeepFilterDefined<B>;
};
