import type { PackageAdapter } from '@package-pal/core';
import { assertNever } from '@package-pal/util';

export const getAdapter = async (adapterName?: 'package-json' | 'csproj'): Promise<PackageAdapter> => {
	const name = adapterName ?? 'package-json';

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
			assertNever(`Unsupported package adapter: '${name as string}'.`);
		}
	}
};
