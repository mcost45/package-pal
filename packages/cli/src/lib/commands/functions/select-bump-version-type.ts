import {
	cancel, isCancel, select,
} from '@clack/prompts';
import { BumpVersionType } from '@package-pal/core';

export const selectBumpVersionType = async () => {
	const bumpType = await select({
		message: 'Select bump type',
		options: Object.entries(BumpVersionType).map(([label, value]) => ({
			label,
			value,
		})),
	});

	if (isCancel(bumpType)) {
		cancel('Operation cancelled: no bump type selected.');
		process.exit(0);
	}

	return bumpType;
};
