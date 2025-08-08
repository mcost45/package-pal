#! /usr/bin/env bun

import { init } from './lib/app.ts';

async function main() {
	await init();
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
