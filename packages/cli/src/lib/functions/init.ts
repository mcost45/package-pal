import { run } from '@stricli/core';
import { app } from '../app.ts';

export const init = () => {
	return run(
		app, process.argv.slice(2), { process },
	);
};
