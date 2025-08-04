import type { SupportedConfigType } from './supported-config-type.ts';

export type ConfigValidationResult = {
	valid: false;
	errorMessage: string;
} | {
	valid: true;
	name: string;
	type: SupportedConfigType;
};
