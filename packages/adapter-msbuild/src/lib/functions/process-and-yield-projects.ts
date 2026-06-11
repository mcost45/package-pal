import { styleText } from 'util';
import type {
	Logger, PackageData,
} from '@package-pal/core';
import {
	normalisePath, formatUnknownError,
} from '@package-pal/util';
import { parseMsbuild } from './parse-msbuild.ts';
import { readProjects } from './read-projects.ts';

/**
 * Normalizes project paths, checks if they've already been yielded, and processes/yields packages.
 * This helper eliminates duplicate logic across different scanning strategies (projects, solutions, glob fallbacks).
 * @yields {PackageData} The parsed package data of each processed project.
 */
export async function* processAndYieldProjects(
	manifestPaths: string[],
	pathToName: Map<string, string>,
	yieldedPaths: Set<string>,
	logger?: Logger,
): AsyncIterable<PackageData> {
	const unyieldedPaths: string[] = [];
	for (const path of manifestPaths) {
		const normalised = normalisePath(path);
		if (!yieldedPaths.has(normalised)) {
			unyieldedPaths.push(path);
		}
	}

	if (unyieldedPaths.length === 0) return;

	for (const path of unyieldedPaths) {
		yieldedPaths.add(normalisePath(path));
	}

	const fileEntries = await readProjects(
		unyieldedPaths, pathToName, logger,
	);
	for (const entry of fileEntries) {
		try {
			const packageData = parseMsbuild(
				entry.path, entry.text, entry.dom, pathToName,
			);
			if (packageData) {
				logger?.debug(styleText('dim', `Successfully read MSBuild project in '${entry.path}'.`));
				yield packageData;
			}
		} catch (e: unknown) {
			logger?.debug(styleText('dim',
				`Failed to parse MSBuild project in '${entry.path}' - ${formatUnknownError(e)}.`));
		}
	}
}
