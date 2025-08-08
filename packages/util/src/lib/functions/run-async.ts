import { RunAsyncType } from '../types/run-async-type.ts';

export const runAsync = async <T>(type: RunAsyncType, tasks: (() => Promise<T>)[]) => {
	if (type === RunAsyncType.Parallel) {
		return Promise.all(tasks.map(task => task()));
	}

	const outputs: T[] = [];

	for (const task of tasks) {
		const result = await task();
		outputs.push(result);
	}

	return outputs;
};
