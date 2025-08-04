import {
	basename, dirname, join,
} from 'path';

const removeTrailing = [
	'~',
	'.tmp',
	'.temp',
	'.bak',
	'.backup',
	'.swp',
	'.swo',
	'.swn',
];

export const normaliseWatchedFilePath = (filePath: string) => {
	const dir = dirname(filePath);
	let base = basename(filePath);

	for (const trailing of removeTrailing) {
		if (base.toLowerCase().endsWith(trailing)) {
			const sliceStart = base.startsWith('.') ? 1 : 0;
			base = base.slice(sliceStart, -trailing.length);
			break;
		}
	}

	return join(dir, base);
};
