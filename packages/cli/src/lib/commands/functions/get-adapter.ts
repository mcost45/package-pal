import { styleText } from 'util';
import type {
	Logger, PackageAdapter,
} from '@package-pal/core';
import { assertNever } from '@package-pal/util';

export const getAdapter = async (
	adapterName?: 'package-json' | 'msbuild' | 'auto',
	cwd: string = process.cwd(),
	logger?: Logger,
): Promise<PackageAdapter> => {
	const name = adapterName ?? 'auto';

	if (name === 'auto') {
		logger?.debug(styleText('dim', `Auto-detecting package adapter in '${cwd}'...`));

		const { PackageJsonAdapter } = await import('@package-pal/adapter-package-json');
		const { MsbuildAdapter } = await import('@package-pal/adapter-msbuild');

		const msbuild = new MsbuildAdapter();
		const packageJson = new PackageJsonAdapter();

		if (await msbuild.detect(cwd)) {
			logger?.debug(styleText('dim', `Detected MSBuild project/solution. Resolving to 'msbuild' adapter.`));
			return msbuild;
		}

		logger?.debug(styleText('dim', `Defaulting to 'package-json' adapter.`));
		return packageJson;
	}

	logger?.debug(styleText('dim', `Using configured package adapter: '${name}'.`));

	switch (name) {
		case 'package-json': {
			const { PackageJsonAdapter } = await import('@package-pal/adapter-package-json');
			return new PackageJsonAdapter();
		}

		case 'msbuild': {
			const { MsbuildAdapter } = await import('@package-pal/adapter-msbuild');
			return new MsbuildAdapter();
		}

		default: {
			return assertNever(`Unsupported package adapter: '${name as string}'.`);
		}
	}
};
