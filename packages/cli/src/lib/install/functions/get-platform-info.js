import {
	arch, platform,
} from 'os';

export const getPlatformInfo = () => {
	const usePlatform = platform();
	const useArch = arch();
	let targetPackage = '';

	switch (usePlatform) {
		case 'darwin':
			targetPackage = useArch === 'arm64' ? 'cli-darwin-arm64' : 'cli-darwin-x64';
			break;

		case 'win32':
			targetPackage = 'cli-windows-x64';
			break;

		case 'linux':
			let isMusl = false;
			try {
				// The report will not have a glibcVersionRuntime property if musl is being used.
				/** @type {{ header?: { glibcVersionRuntime?: unknown } }} */
				const report = process.report.getReport();
				isMusl = !report.header?.glibcVersionRuntime;
			} catch {
				isMusl = true;
			}

			targetPackage
				= useArch === 'arm64'
					? isMusl
						? 'cli-linux-arm64-musl'
						: 'cli-linux-arm64'
					: isMusl
						? 'cli-linux-x64-musl'
						: 'cli-linux-x64';
	}

	if (!targetPackage) {
		throw new Error(`Unsupported target: ${usePlatform} ${useArch}.`);
	}

	return {
		platform: usePlatform,
		arch: useArch,
		targetPackage,
	};
};
