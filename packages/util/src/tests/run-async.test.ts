import {
	expect, test,
} from 'bun:test';
import { runAsync } from '@package-pal/util';

test.each([
	NaN,
	0.5,
	Infinity,
	0,
	-1,
])('Rejects invalid concurrency %s before running work', async (concurrency) => {
	let executed = false;
	const result = await runAsync([() => {
		executed = true;
		return Promise.resolve('done');
	}], concurrency).catch((error: unknown) => error);
	expect(result).toMatchObject({ message: 'Concurrency must be a positive integer.' });
	expect(executed).toBe(false);
});
