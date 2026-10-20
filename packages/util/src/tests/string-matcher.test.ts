import {
	expect, test,
} from 'bun:test';
import { getStringMatcher } from '@package-pal/util';

test.each([
	{
		search: 'READY',
		chunks: ['READY\nFurther startup logging after the readiness marker'],
		expected: 'READY',
	},
	{
		search: ['Ready', 'Listening on port'],
		chunks: ['Listening on port 3000'],
		expected: 'Listening on port',
	},
	{
		search: ['Ready', 'Listening on port'],
		chunks: ['Starting: List', 'ening on port 3000'],
		expected: 'Listening on port',
	},
])('Matches streamed output: $expected in $chunks', ({
	search, chunks, expected,
}) => {
	const matcher = getStringMatcher(typeof search === 'string' ? search : [...search]);
	for (const chunk of chunks) {
		matcher.push(chunk);
	}
	expect(matcher.matched()).toBe(expected);
	matcher.reset();
	expect(matcher.matched()).toBeUndefined();
});
