import { styleText } from 'node:util';
import { assertDefined } from '@package-pal/util';
import type { Logger } from '../../configuration/types/logger.ts';
import { DependenciesField } from '../../package/types/dependencies-field.ts';
import type { PackageData } from '../../package/types/package-data.ts';
import type { PackageGraph } from '../types/package-graph.ts';

interface TrackPackageOptions {
	trackedDependencies: Set<string>;
	packageNames: Set<string>;
	packageData: PackageData;
}

const trackPackageEntryDependencies = ({
	trackedDependencies,
	packageNames,
	packageData,
}: TrackPackageOptions) => {
	const iterateEntries = Object.values(DependenciesField).map(field => packageData[field]);

	for (const packageEntries of iterateEntries) {
		if (!packageEntries) {
			continue;
		}

		for (const trackPackageName of Object.keys(packageEntries)) {
			if (!packageNames.has(trackPackageName)) {
				continue;
			}

			trackedDependencies.add(trackPackageName);
		}
	}
};

const generateReverseGraph = (packages: PackageData[], packageGraph: PackageGraph) => {
	const reversePackageGraph: PackageGraph = new Map(packages.map(packageData => [packageData.name, {
		packageData: packageData,
		pointsToPackages: new Set<string>(),
	}]));

	for (const packageData of packages) {
		const packageNode = assertDefined(packageGraph.get(packageData.name));

		for (const dependency of packageNode.pointsToPackages) {
			const reverseNode = assertDefined(reversePackageGraph.get(dependency));
			reverseNode.pointsToPackages.add(packageData.name);
		}
	}

	return reversePackageGraph;
};

export const generateGraphs = (packages: PackageData[], logger: Logger) => {
	logger.debug(styleText('dim', `Generating package graphs for ${packages.length.toString()} packages...`));
	const packageNames = new Set(packages.map(packageData => packageData.name));
	const packageGraph: PackageGraph = new Map();

	for (const packageData of packages) {
		const trackedDependencies = new Set<string>();

		trackPackageEntryDependencies({
			trackedDependencies,
			packageNames,
			packageData,
		});

		packageGraph.set(packageData.name, {
			packageData: packageData,
			pointsToPackages: trackedDependencies,
		});
	}

	const reversePackageGraph = generateReverseGraph(packages, packageGraph);

	return {
		dependencies: packageGraph,
		dependents: reversePackageGraph,
	};
};
