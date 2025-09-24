class StringMatcher {
	private buffer = '';
	private cacheResult: string | undefined = undefined;
	private readonly search: string[];
	private readonly maxBufferLength: number;

	constructor(search: string | string[]) {
		this.search = Array.isArray(search) ? search : [search];
		this.maxBufferLength = search.length * 2;
	}

	push(chunk: string): this {
		this.cacheResult = undefined;
		this.buffer += chunk;

		if (this.buffer.length > this.maxBufferLength) {
			this.buffer = this.buffer.slice(-this.maxBufferLength);
		}

		return this;
	}

	reset(): this {
		this.cacheResult = undefined;
		this.buffer = '';
		return this;
	}

	matched(): string | undefined {
		this.cacheResult ??= this.search.find(value => this.buffer.includes(value));
		return this.cacheResult;
	}
}

export const getStringMatcher = (search: string | string[]) => {
	return new StringMatcher(search);
};
