import { assertDefined } from '@package-pal/util';
import {
	type CommandContext,
	buildApplication,
	type Application,
	buildRouteMap,
	run,
	type StricliProcess,
	version,
} from '@stricli/core';
import packageJson from '../../package.json';
import { bump } from './commands/bump.ts';
import { checkCircular } from './commands/check-circular.ts';
import { forEach } from './commands/for-each.ts';
import { list } from './commands/list.ts';
import { watch } from './commands/watch.ts';

const root = buildRouteMap({
	routes: {
		watch,
		bump,
		checkCircular,
		forEach,
		list,
	},
	docs: { brief: 'Use PackagePal to manage monorepo dependencies' },
	aliases: { ls: 'list' },
});

const currentVersion = assertDefined(Object.values(packageJson.optionalDependencies)[0]);
const app: Application<CommandContext> = buildApplication(
	root,
	{
		name: assertDefined(Object.keys(packageJson.bin)[0]),
		scanner: { caseStyle: 'allow-kebab-for-camel' },
	},
	{ version: version({
		brief: 'Print the current version of the application',
		alias: 'v',
		info: { currentVersion },
	}) },
);

export const init = () => {
	return run(
		app, process.argv.slice(2), { process: process as StricliProcess },
	);
};
