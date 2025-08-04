import { identity } from '@package-pal/util';

export const getLineBufferedWriter = (
	prefix: string, style: (s: string) => string = identity, write: (chunk: string) => void = process.stdout.write.bind(process.stdout),
) => {
	let buffer = '';

	return (chunk: string) => {
		buffer += chunk;

		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			write(`${prefix}${style(line)}\n`);
		}
	};
};
