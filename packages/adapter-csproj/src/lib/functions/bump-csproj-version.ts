export const bumpCsprojVersion = (raw: string, bumpedVersion: string): string => {
	if (raw.includes('<Version>')) {
		return raw.replace(/<Version>[^<]*<\/Version>/, `<Version>${bumpedVersion}</Version>`);
	}

	if (raw.includes('<VersionPrefix>')) {
		return raw.replace(/<VersionPrefix>[^<]*<\/VersionPrefix>/, `<VersionPrefix>${bumpedVersion}</VersionPrefix>`);
	}

	// Insert <Version> inside first PropertyGroup
	const propertyGroupIndex = raw.indexOf('<PropertyGroup>');
	if (propertyGroupIndex !== -1) {
		const insertAt = propertyGroupIndex + '<PropertyGroup>'.length;
		return raw.slice(0, insertAt) + `\n    <Version>${bumpedVersion}</Version>` + raw.slice(insertAt);
	}

	// No PropertyGroup found, append a new PropertyGroup to the root element
	const projectIndex = raw.indexOf('<Project');
	if (projectIndex !== -1) {
		const projectEndIndex = raw.indexOf('>', projectIndex);
		if (projectEndIndex !== -1) {
			const insertAt = projectEndIndex + 1;
			return raw.slice(0, insertAt) + `\n  <PropertyGroup>\n    <Version>${bumpedVersion}</Version>\n  </PropertyGroup>` + raw.slice(insertAt);
		}
	}

	return raw;
};
