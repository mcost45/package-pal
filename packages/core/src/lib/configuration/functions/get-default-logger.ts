import {
	assertDefined, noOp,
} from '@package-pal/util';
import type { SchemaLogLevel } from '../types/config.ts';
import type { Logger } from '../types/logger.ts';

const levelOrder: Record<SchemaLogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	silent: Infinity,
};

export const getDefaultLogger = (logLevel: SchemaLogLevel): Logger => {
	const level = assertDefined(levelOrder[logLevel]);

	return {
		debug: level <= levelOrder.debug ? console.debug : noOp,
		info: level <= levelOrder.info ? console.info : noOp,
		warn: level <= levelOrder.warn ? console.warn : noOp,
		error: level <= levelOrder.error ? console.error : noOp,
	};
};
