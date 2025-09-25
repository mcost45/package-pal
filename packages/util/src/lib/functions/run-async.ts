import { isDefined } from './is-defined.ts';

export const runAsync = async <T>(tasks: (() => Promise<T>)[], concurrency?: number | null) => {
	if (!isDefined(concurrency) || concurrency <= 0 || concurrency >= tasks.length) {
		return Promise.all(tasks.map(task => task()));
	}

	const results = new Array<T>(tasks.length);
	const iterator = tasks.entries();

	const concurrentTasks = async () => {
		let next = iterator.next();
		while (!next.done) {
			const [index, task] = next.value;
			results[index] = await task();
			next = iterator.next();
		}
	};

	await Promise.all(Array.from({ length: concurrency }, concurrentTasks));

	return results;
};
