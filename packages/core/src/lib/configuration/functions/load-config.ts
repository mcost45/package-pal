import { styleText } from 'node:util';
import { dirname } from 'path';
import { cwd } from 'process';
import {
	deepMergeDefined, formatSimpleLogObject, noOp,
} from '@package-pal/util';
import type {
	ActivatedConfig, ActivatedConfigAndRootDir,
} from '../types/activated-config.ts';
import type { Logger } from '../types/logger.ts';
import { getDefaultLogger } from './get-default-logger.ts';
import { parseConfig } from './parse-config.ts';
import { searchConfigPath } from './search-config-path.ts';

const defaultConfig: ActivatedConfig = {
	packages: 'packages/*',
	version: {
		preId: '',
		exact: false,
	},
	watch: {
		debounceMs: 500,
		hooks: {
			onInit: noOp,
			onBeforeProcessPackage: noOp,
			onProcessPackage: noOp,
			onProcessPackageError: noOp,
			onAfterProcessPackage: noOp,
			onBeforePackagesReady: noOp,
			onPackagesReady: noOp,
			onAfterPackagesReady: noOp,
		},
		subprocess: {
			partialProcessing: false,
			concurrency: null,
			matchLongRunningOutputAsReady: null,
			matchLongRunningOutputAsErrored: null,
		},
	},
	logger: getDefaultLogger('info'),
	logLevel: 'info',
};

export const loadConfig = async (overrideConfigPath: string | undefined): Promise<ActivatedConfigAndRootDir> => {
	const path = await searchConfigPath(overrideConfigPath);

	if (!path) {
		defaultConfig.logger.info('No config file found. Defaults will be applied.');
		return {
			config: defaultConfig,
			rootDir: cwd(),
		};
	}

	const parsedConfig = await parseConfig(path);
	const parsedLogger = parsedConfig['logger' as keyof typeof parsedConfig] as Logger | undefined;
	const logger = parsedLogger ?? (!parsedConfig.logLevel || parsedConfig.logLevel === defaultConfig.logLevel ? defaultConfig.logger : getDefaultLogger(parsedConfig.logLevel));
	logger.debug(`Successfully loaded config file '${path}'.`);
	logger.debug(styleText('dim', styleText('bgGray', 'User config:')), `\n${styleText('dim', formatSimpleLogObject(parsedConfig))}`);

	logger.debug(styleText('dim', styleText('bgGray', 'Default config:')), `\n${styleText('dim', formatSimpleLogObject(defaultConfig))}`);
	const activatedConfig = deepMergeDefined(defaultConfig, parsedConfig);
	// @ts-expect-error Override readonly.
	activatedConfig.logger = logger;
	logger.debug(styleText('dim', styleText('bgGray', 'Activated config:')), `\n${styleText('dim', formatSimpleLogObject(activatedConfig))}`);

	return {
		config: activatedConfig,
		rootDir: dirname(path),
	};
};
