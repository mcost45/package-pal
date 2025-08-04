import type { PackageChanges } from '../../watch/types/package-changes.ts';

export interface ProcessPackageCallbackProps {
	name: string;
	dir: string;
	filePaths: string[];
	signal: AbortSignal;
	totalChanges: PackageChanges;
	totalProcessOrder: string[][];
}
