export const bumpMsbuildReferenceVersion = (
	dependentRaw: string,
	packageName: string,
	bumpedVersion: string,
): {
	updatedRaw: string;
	currentVersion: string;
} | undefined => {
	// Look for <PackageReference Include="packageName" Version="..." />
	const packageRefRegex = new RegExp(`(<PackageReference\\s+[^>]*Include=["']${packageName}["'][^>]*Version=["'])([^"']*)(["'])`, 'gi');
	const match = packageRefRegex.exec(dependentRaw);
	if (!match) {
		return undefined;
	}

	const currentVersion = match[2] ?? '';
	const updatedRaw = dependentRaw.replace(packageRefRegex, `$1${bumpedVersion}$3`);

	if (updatedRaw !== dependentRaw) {
		return {
			updatedRaw,
			currentVersion,
		};
	}

	return undefined;
};
