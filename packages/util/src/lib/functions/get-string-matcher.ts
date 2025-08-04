class StringMatcher {
	private buffer = '';
	private readonly search: string;
	private readonly maxBufferLength: number;

	constructor(search: string) {
		this.search = search;
		this.maxBufferLength = search.length * 2;
	}

	push(chunk: string): this {
		this.buffer += chunk;

		if (this.buffer.length > this.maxBufferLength) {
			this.buffer = this.buffer.slice(-this.maxBufferLength);
		}

		return this;
	}

	reset(): this {
		this.buffer = '';
		return this;
	}

	matched(): boolean {
		return this.buffer.includes(this.search);
	}
}

export const getStringMatcher = (search: string) => {
	return new StringMatcher(search);
};
