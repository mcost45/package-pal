import { Config } from '../schemas/config.ts';
import type { SchemaConfig } from '../types/config.ts';
import { validateConfigPath } from './validate-config-path.ts';

export const parseConfig = async (path: string) => {
	const result = validateConfigPath(path);

	if (!result.valid) {
		throw new Error(result.errorMessage);
	}

	const module = await import(path) as { default?: SchemaConfig };
	const base = (module.default ?? module) as SchemaConfig;
	return Config.parse(base);
};
