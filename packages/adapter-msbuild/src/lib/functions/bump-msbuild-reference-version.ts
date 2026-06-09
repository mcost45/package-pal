export const bumpMsbuildReferenceVersion = (
	dependentRaw: string,
	packageName: string,
	bumpedVersion: string,
): string | undefined => {
	// Look for <PackageReference Include="packageName" Version="..." />
	const packageRefRegex = new RegExp(`(<PackageReference\\s+[^>]*Include=["']${packageName}["'][^>]*Version=["'])([^"']*)(["'])`, 'gi');
	const updatedDependentRaw = dependentRaw.replace(packageRefRegex, `$1${bumpedVersion}$3`);

	if (updatedDependentRaw !== dependentRaw) {
		return updatedDependentRaw;
	}

	return undefined;
};
