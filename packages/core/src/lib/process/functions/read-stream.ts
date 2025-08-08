export const readStream = async (stream: ReadableStream<Uint8Array> | null,
	use: (chunk: string) => void) => {
	if (!stream) {
		return;
	}

	const decoder = new TextDecoder();
	const reader = stream.getReader();

	let result = await reader.read();
	while (!result.done) {
		use(decoder.decode(result.value, { stream: true }));
		result = await reader.read();
	}

	const flush = decoder.decode();
	if (flush) {
		use(flush);
	}
};
