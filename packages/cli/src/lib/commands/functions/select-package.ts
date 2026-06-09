import {
	autocomplete, cancel, isCancel, select,
} from '@clack/prompts';
import type { PackageData } from '@package-pal/core';

const minOptionsForSearch = 4;

export const selectPackage = async (packageData: PackageData[]) => {
	const message = 'Select a package';
	const options = packageData.map(({ name }) => ({
		label: name,
		value: name,
	}));

	const packageName
		= packageData.length >= minOptionsForSearch
			? await autocomplete({
					message,
					options,
				})
			: await select({
					message,
					options,
				});

	if (isCancel(packageName)) {
		cancel('Operation cancelled: no package selected.');
		process.exit(0);
	}

	return packageName;
};
