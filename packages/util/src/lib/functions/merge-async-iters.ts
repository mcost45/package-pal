import { assertDefined } from './assert-defined.ts';

export const mergeAsyncIters = <T>(iterables: AsyncIterable<T>[]): AsyncIterable<T> => ({ async* [Symbol.asyncIterator](): AsyncIterator<T> {
	const iters = iterables.map(iter => iter[Symbol.asyncIterator]());
	const results = iters.map(iter => iter.next());

	while (iters.length > 0) {
		const nextResult = await Promise.race(results.map((p, i) => p.then((result: IteratorResult<T, T>) => ({
			index: i,
			...result,
		}))));

		const {
			index, value, done,
		} = nextResult;

		if (done) {
			iters.splice(index, 1);
			void results.splice(index, 1);
			continue;
		}

		results[index] = assertDefined(iters[index]).next();
		yield value;
	}
} });
