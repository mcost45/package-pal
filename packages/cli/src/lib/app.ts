import { assertDefined } from '@package-pal/util';
import {
	type CommandContext,
	buildApplication,
	type Application,
	buildRouteMap,
} from '@stricli/core';
import packageJson from '../../package.json';
import { bump } from './commands/bump.ts';
import { watch } from './commands/watch.ts';

const root = buildRouteMap({
	routes: {
		watch,
		bump,
	},
	docs: { brief: 'Use PackagePal to help manage JS monorepo dependencies' },
});

export const app: Application<CommandContext> = buildApplication(root, {
	name: assertDefined(Object.keys(packageJson.bin)[0]),
	versionInfo: { currentVersion: packageJson.version },
});
