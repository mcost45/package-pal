import { select } from '@clack/prompts';
import { BumpVersionType } from '@package-pal/core';

export const selectBumpVersionType = async () => {
	const bumpType = await select({
		message: 'Select bump type',
		options: Object.entries(BumpVersionType).map(([label, value]) => ({
			label,
			value,
		})),
	});

	if (typeof bumpType !== 'string') {
		throw new Error('A bump type must be selected.');
	}

	return bumpType;
};
