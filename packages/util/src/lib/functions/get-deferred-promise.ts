import type { DeferredPromise } from '../types/deferred-promise.ts';

export const getDeferredPromise = <T = void>(): DeferredPromise<T> => {
	let resolve!: (value: PromiseLike<T> | T) => void;
	let reject!: () => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return {
		promise,
		resolve,
		reject,
	};
};
