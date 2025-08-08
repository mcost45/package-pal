import { select } from '@clack/prompts';
import type { PackageData } from '@package-pal/core';

export const selectPackage = async (packageData: PackageData[]) => {
	const packageName = await select({
		message: 'Select a package',
		options: packageData.map(({ name }) => ({ value: name })),
	});

	if (typeof packageName !== 'string') {
		throw new Error('A package must be selected.');
	}

	return packageName;
};
