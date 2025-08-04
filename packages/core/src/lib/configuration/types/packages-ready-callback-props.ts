import type { PackageChanges } from '../../watch/types/package-changes.ts';

export interface PackagesReadyCallbackProps {
	signal: AbortSignal;
	totalChanges: PackageChanges;
	totalProcessOrder: string[][];
}
