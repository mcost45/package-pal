#! /usr/bin/env bun

// const c = await readPackagePalConfig();
// const pd = await readPackageData({ config: c });
// const g = getPackageGraphs({
// 	config: c,
// 	packageData: pd,
// });
// const o = getPackageOrder({
// 	config: c,
// 	packageGraphs: g,
// });
// const n = getPackageCircularDependencyPaths({
// 	config: c,
// 	packageGraphs: g,
// 	packageOrder: o,
// });
//
// // await bumpPackageVersion({
// // 	packageName: '@ppims/shared-functionality',
// // 	type: BumpVersionType.Major,
// // 	packageGraphs: g,
// // 	config: c,
// // 	// exact: true
// // });
//
// watchPackages({
// 	config: c,
// 	packageData: pd,
// 	packageGraphs: g,
// });

import { init } from './lib/functions/init.ts';

await init();
