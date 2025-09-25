export interface PackageData {
	rawContent: string;
	name: string;
	path: string;
	dir: string;
	version?: string | undefined;
	dependencies?: Record<string, string> | undefined;
	peerDependencies?: Record<string, string> | undefined;
	devDependencies?: Record<string, string> | undefined;
	optionalDependencies?: Record<string, string> | undefined;
}
