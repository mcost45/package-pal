import { styleText } from 'node:util';
import { assertDefined } from '@package-pal/util';
import type { ActivatedWatchConfig } from '../../configuration/types/activated-config.ts';
import type { Logger } from '../../configuration/types/logger.ts';
import { extractSubgraph } from '../../graph/functions/extract-subgraph.ts';
import { generateTopologicalRankingRange } from '../../graph/functions/generate-topological-ranking-range.ts';
import { generateTopologicalRanking } from '../../graph/functions/generate-topological-ranking.ts';
import { generateTopologicalSortedGroups } from '../../graph/functions/generate-topological-sorted-groups.ts';
import { isDisjoint } from '../../graph/functions/is-disjoint.ts';
import { isRankedGreaterThanOrEqual } from '../../graph/functions/is-ranked-greater-than-or-equal.ts';
import { isSubgraph } from '../../graph/functions/is-subgraph.ts';
import type { PackageGraph } from '../../graph/types/package-graph.ts';
import type { PackageGraphs } from '../../graph/types/package-graphs.ts';
import { ChangeAction } from '../types/change-action.ts';
import type { PackageChanges } from '../types/package-changes.ts';

export const getChangeLogic = (
	packageGraphs: PackageGraphs,
	packageChanges: PackageChanges,
	lastProcessedSubgraph: PackageGraph | undefined,
	config: ActivatedWatchConfig,
	logger: Logger,
) => {
	const changedPackages = Array.from(packageChanges.keys());
	const changedFilePaths = Array.from(packageChanges.values()).flat();

	if (packageChanges.size) {
		logger.debug(styleText('dim', `Changes detected in ${changedPackages.map(packageName => `'${packageName}'`).join(', ')}.`));
		logger.debug(styleText('dim', `Changed file paths: ${changedFilePaths.map(filePath => `'${filePath}'`).join(', ')}.`));
	}

	const packageOrder = generateTopologicalSortedGroups(packageGraphs.dependents, logger);
	const packageProcessOrder = packageOrder.groups.toReversed().concat(packageOrder.circular);
	const packageRankings = generateTopologicalRanking(packageProcessOrder);

	const changedPackageSubgraph = extractSubgraph(packageGraphs.dependents, changedPackages);
	const changedPackageOrder = generateTopologicalSortedGroups(changedPackageSubgraph, logger);
	const changedPackageProcessOrder = changedPackageOrder.groups.toReversed().concat(changedPackageOrder.circular);

	const isSubgraphOfPrevious = !!lastProcessedSubgraph && isSubgraph(lastProcessedSubgraph, changedPackageSubgraph);
	const isDisjointFromPrevious = !lastProcessedSubgraph || (!isSubgraphOfPrevious && isDisjoint(lastProcessedSubgraph, changedPackageSubgraph));
	const isRankedGreaterThanOrEqualToPrevious = !!lastProcessedSubgraph && !isSubgraphOfPrevious && isRankedGreaterThanOrEqual(
		lastProcessedSubgraph, changedPackageSubgraph, packageRankings,
	);

	logger.debug(styleText('dim', `Changes are subgraph of previous: ${isSubgraphOfPrevious.toString()}.`));
	logger.debug(styleText('dim', `Changes are disjoint from previous: ${isDisjointFromPrevious.toString()}.`));
	logger.debug(styleText('dim', `Changes are ranked greater than or equal to previous: ${isRankedGreaterThanOrEqualToPrevious.toString()}.`));

	let action: ChangeAction = ChangeAction.Restart;
	if (!packageChanges.size) {
		action = ChangeAction.Ignore;
	} else if (!config.subprocess.partialProcessing) {
		action = ChangeAction.Restart;
	} else if (isSubgraphOfPrevious) {
		action = ChangeAction.Ignore;
	} else if (isDisjointFromPrevious || isRankedGreaterThanOrEqualToPrevious) {
		action = ChangeAction.Partial;
	}

	if (action === ChangeAction.Partial && isRankedGreaterThanOrEqualToPrevious) {
		const [prevMinRank] = generateTopologicalRankingRange(assertDefined(lastProcessedSubgraph), packageRankings);

		for (let i = 0; i < changedPackageProcessOrder.length; i++) {
			changedPackageProcessOrder[i] = assertDefined(changedPackageProcessOrder[i]).filter((packageName) => {
				const rank = packageRankings.get(packageName);
				return rank !== undefined && rank >= prevMinRank;
			});
		}
	}

	logger.debug(styleText('dim', `Determined change action: ${action}.`));

	return {
		changedPackageProcessOrder,
		changedPackageSubgraph,
		action,
	};
};
