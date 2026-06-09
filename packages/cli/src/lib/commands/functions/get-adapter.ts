import { styleText } from 'util';
import type {
	Logger, PackageAdapter,
} from '@package-pal/core';
import { assertNever } from '@package-pal/util';

let cachedAdapter: PackageAdapter | undefined;

export const getAdapter = async (
	adapterName?: 'package-json' | 'csproj' | 'auto',
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
		const { CsprojAdapter } = await import('@package-pal/adapter-csproj');

		const csproj = new CsprojAdapter();
		const packageJson = new PackageJsonAdapter();

		if (await csproj.detect(cwd)) {
			logger?.debug(styleText('dim', `Detected MSBuild project/solution. Resolving to 'csproj' adapter.`));
			cachedAdapter = csproj;
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

		case 'csproj': {
			const { CsprojAdapter } = await import('@package-pal/adapter-csproj');
			return new CsprojAdapter();
		}

		default: {
			return assertNever(`Unsupported package adapter: '${name as string}'.`);
		}
	}
};
