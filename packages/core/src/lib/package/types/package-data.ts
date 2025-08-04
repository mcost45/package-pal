export interface PackageData {
	rawContent: string;
	name: string;
	path: string;
	dir: string;
	version?: string;
	dependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}
