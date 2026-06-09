import { styleText } from 'util';
import type {
	Logger, PackageAdapter,
} from '@package-pal/core';
import { assertNever } from '@package-pal/util';

let cachedAdapter: PackageAdapter | undefined;

export const getAdapter = async (
	adapterName?: 'package-json' | 'msbuild' | 'auto',
	cwd: string = process.cwd(),
	logger?: Logger,
): Promise<PackageAdapter> => {
	const name = adapterName ?? 'auto';

	if (name === 'auto') {
		if (cachedAdapter) {
			logger?.debug(styleText('dim', `Using cached package adapter: '${cachedAdapter.name}'.`));
			return cachedAdapter;
		}

		logger?.debug(styleText('dim', `Auto-detecting package adapter in '${cwd}'...`));

		const { PackageJsonAdapter } = await import('@package-pal/adapter-package-json');
		const { MsbuildAdapter } = await import('@package-pal/adapter-msbuild');

		const msbuild = new MsbuildAdapter();
		const packageJson = new PackageJsonAdapter();

		if (await msbuild.detect(cwd)) {
			logger?.debug(styleText('dim', `Detected MSBuild project/solution. Resolving to 'msbuild' adapter.`));
			cachedAdapter = msbuild;
		} else {
			logger?.debug(styleText('dim', `Defaulting to 'package-json' adapter.`));
			cachedAdapter = packageJson;
		}

		return cachedAdapter;
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
