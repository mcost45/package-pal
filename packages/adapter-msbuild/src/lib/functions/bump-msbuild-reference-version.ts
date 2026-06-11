const regexCache = new Map<string, RegExp>();

export const bumpMsbuildReferenceVersion = (
	dependentRaw: string,
	packageName: string,
	bumpedVersion: string,
): {
	updatedRaw: string;
	currentVersion: string;
} | undefined => {
	let packageRefRegex = regexCache.get(packageName);
	if (!packageRefRegex) {
		packageRefRegex = new RegExp(`(<PackageReference\\s+[^>]*Include=["']${packageName}["'][^>]*Version=["'])([^"']*)(["'])`, 'gi');
		regexCache.set(packageName, packageRefRegex);
	}

	// Reset regex state since it has global/sticky flags
	packageRefRegex.lastIndex = 0;

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
