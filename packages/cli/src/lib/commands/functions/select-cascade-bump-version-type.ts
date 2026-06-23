import {
	cancel, isCancel, select,
} from '@clack/prompts';
import { BumpVersionType } from '@package-pal/core';

export const selectCascadeBumpVersionType = async (): Promise<BumpVersionType | undefined> => {
	const cascadeType = await select({
		message: 'Select cascade bump type for dependents (optional)',
		options: [{
			label: 'None (do not cascade bump)',
			value: 'none',
		}, ...Object.entries(BumpVersionType).map(([label, value]) => ({
			label,
			value,
		}))],
	});

	if (isCancel(cascadeType)) {
		cancel('Operation cancelled.');
		process.exit(0);
	}

	return cascadeType === 'none' ? undefined : (cascadeType);
};
