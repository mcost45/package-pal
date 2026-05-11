import { identity } from '@package-pal/util';

/**
 * Creates a writer that buffers input chunks and writes them line-by-line, prepending a prefix to each line.
 */
export const getLineBufferedWriter = (
	prefix: string,
	style: (s: string) => string = identity,
	write: (chunk: string) => void = process.stdout.write.bind(process.stdout),
) => {
	let buffer = '';

	return {
		write: (chunk: string | null) => {
			if (chunk === null) {
				if (buffer.length > 0) {
					write(`${prefix}${style(buffer)}\n`);
					buffer = '';
				}
				return;
			}

			buffer += chunk;
			let start = 0;
			let newlineIndex = buffer.indexOf('\n');

			while (newlineIndex !== -1) {
				let end = newlineIndex;

				// Handle CRLF (\r\n)
				if (end > start && buffer[end - 1] === '\r') {
					end--;
				}

				const line = buffer.slice(start, end);
				write(`${prefix}${style(line)}\n`);

				start = newlineIndex + 1;
				newlineIndex = buffer.indexOf('\n', start);
			}

			// Keep only the remaining partial line in the buffer
			buffer = buffer.slice(start);
		},
		flush() {
			this.write(null);
		},
	};
};
