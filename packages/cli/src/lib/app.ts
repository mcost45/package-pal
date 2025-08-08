import { assertDefined } from '@package-pal/util';
import {
	type CommandContext,
	buildApplication,
	type Application,
	buildRouteMap,
	run,
} from '@stricli/core';
import packageJson from '../../package.json';
import { bump } from './commands/bump.ts';
import { checkCircular } from './commands/check-circular.ts';
import { watch } from './commands/watch.ts';

const root = buildRouteMap({
	routes: {
		watch,
		bump,
		checkCircular,
	},
	docs: { brief: 'Use PackagePal to help manage JS monorepo dependencies' },
});

const app: Application<CommandContext> = buildApplication(root, {
	name: assertDefined(Object.keys(packageJson.bin)[0]),
	versionInfo: { currentVersion: packageJson.version },
	scanner: { caseStyle: 'allow-kebab-for-camel' },
});

export const init = () => {
	return run(
		app, process.argv.slice(2), { process },
	);
};
