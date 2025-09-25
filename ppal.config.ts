import type { Config } from '@package-pal/core';

export default {
	packages: ['packages/*'],
	watch: { subprocess: { partialProcessing: true } },
} satisfies Config;
