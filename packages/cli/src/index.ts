#!/usr/bin/env bun

import { init } from './lib/app.ts';

const main = () => {
	return init();
};

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
