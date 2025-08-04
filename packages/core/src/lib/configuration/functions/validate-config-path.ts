import {
	basename, extname,
} from 'path';
import type { ConfigValidationResult } from '../types/config-validation-result.ts';
import { SupportedConfigType } from '../types/supported-config-type.ts';

export const CONFIG_SUPPORTED_BASE_NAME = 'ppal.config' as const;

export const CONFIG_SUPPORTED_TYPES = Object.values(SupportedConfigType);

export const CONFIG_SUPPORTED_NAMES = CONFIG_SUPPORTED_TYPES.map(type => `${CONFIG_SUPPORTED_BASE_NAME}.${type}` as const);

export const validateConfigPath = (path: string): ConfigValidationResult => {
	const name = basename(path);
	const extension = extname(path);
	const type = CONFIG_SUPPORTED_TYPES.find(option => `.${option}` === extension);

	if (!name.startsWith(CONFIG_SUPPORTED_BASE_NAME) || !type) {
		return {
			valid: false,
			errorMessage: `'${name}' is not a valid config file. Only '${CONFIG_SUPPORTED_NAMES.join(', ')}' are supported.`,
		};
	}

	return {
		valid: true,
		name,
		type,
	};
};
