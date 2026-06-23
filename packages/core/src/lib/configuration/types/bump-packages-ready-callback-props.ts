import type { BumpPackage } from './bump-package-callback-props.ts';

export interface BumpPackagesReadyCallbackProps {
	/**
	 * All packages whose own version was bumped, keyed by package name.
	 *
	 * Shell commands returned by bump ready hooks do not receive package-specific `PP_*` environment variables.
	 */
	totalBumps: Map<string, BumpPackage>;
	/**
	 * Bumped package order grouped by packages that were bumped in the same topological phase.
	 */
	totalBumpOrder: string[][];
}
