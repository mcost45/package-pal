import {
	realpathSync, existsSync,
} from 'fs';
import {
	dirname, resolve, extname, isAbsolute,
} from 'path';
import type { Logger } from '@package-pal/core';
import {
	normalisePath, formatUnknownError,
} from '@package-pal/util';
import { XML } from 'bun';
import {
	attribute, walkElements,
} from './xml.ts';

const canOpenFile = (filePath: string): boolean => {
	return existsSync(filePath);
};

const knownExtensions = new Set([
	'.csproj',
	'.fsproj',
	'.vbproj',
	'.vcxproj',
	'.sqlproj',
	'.shproj',
	'.dbproj',
	'.wapproj',
	'.sfproj',
	'.ccproj',
	'.njsproj',
	'.pyproj',
	'.deployproj',
	'.wdproj',
	'.modelproj',
]);

const isProjectFile = (filePath: string): boolean => {
	const ext = extname(filePath).toLowerCase();
	return knownExtensions.has(ext);
};

const resolveSlnPath = (slnDir: string, pathValue: string): string => {
	// Replace MSBuild properties like $(SolutionDir) with slnDir
	let cleanPath = pathValue.replace(/\$\([Ss]olution[Dd]ir\)/g, slnDir);
	// Strip out other MSBuild property expressions that might be left
	cleanPath = cleanPath.replace(/\$\([^)]+\)/g, '');

	if (isAbsolute(cleanPath)) {
		return normalisePath(cleanPath);
	}
	// Handle relative paths
	return normalisePath(resolve(slnDir, cleanPath));
};

const canonicalizePath = (filePath: string): string => {
	let canonical = normalisePath(filePath);
	try {
		canonical = normalisePath(realpathSync(filePath));
	} catch {
		// Fallback if realpath fails
	}
	return canonical;
};

const findSlnxProjects = (root: XML.Node, slnDir: string): string[] => {
	const paths: string[] = [];
	for (const node of walkElements(root)) {
		const pathValue = attribute(node, 'Path') ?? attribute(node, 'Include') ?? attribute(node, 'Update');
		if (pathValue) {
			const resolved = resolveSlnPath(slnDir, pathValue);
			if (isProjectFile(resolved)) paths.push(resolved);
		}
	}
	return paths;
};

export const parseSln = async (solutionPaths: string[],
	logger?: Logger): Promise<string[]> => {
	const projectPaths = new Set<string>();
	const lowercaseSeen = new Set<string>();

	const addPath = (resolvedPath: string) => {
		const canonical = canonicalizePath(resolvedPath);
		const lower = canonical.toLowerCase();
		if (!lowercaseSeen.has(lower)) {
			lowercaseSeen.add(lower);
			projectPaths.add(canonical);
		}
	};

	for (const slnPath of solutionPaths) {
		try {
			const slnDir = dirname(slnPath);
			const file = Bun.file(slnPath);
			const isSlnx = extname(slnPath).toLowerCase() === '.slnx';

			const candidates: string[] = [];

			if (isSlnx) {
				const dom = XML.parse(await file.bytes(), { compact: false });
				const resolvedPaths = findSlnxProjects(dom, slnDir);
				candidates.push(...resolvedPaths);
			} else {
				const text = await file.text();
				// Match Project blocks and collect all quoted strings inside the block header
				// Immune to any spacing, newlines, line continuations, indentation, or punctuation variation
				// By matching \bProject\s*\( we avoid matching the word "Project" inside paths or directories
				const projectBlockRegex = /\bProject\s*\(([\s\S]*?)(?=\bEndProject\b|\bProjectSection\b|\bProject\s*\(|$)/gi;
				let match;
				while ((match = projectBlockRegex.exec(text)) !== null) {
					const blockContent = match[1];
					if (blockContent === undefined) {
						continue;
					}
					// Extract all quoted strings from this block header
					const quotedRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
					const strings: string[] = [];
					let qMatch;
					while ((qMatch = quotedRegex.exec(blockContent)) !== null) {
						const val = qMatch[1] ?? qMatch[2];
						if (val !== undefined) {
							strings.push(val);
						}
					}

					// In solution files, the project header strings are:
					// [0] Project Type GUID, [1] Project Name, [2] Project Path, [3] Project GUID
					if (strings.length >= 3) {
						const pathValue = strings[2];
						if (pathValue !== undefined) {
							const resolved = resolveSlnPath(slnDir, pathValue);
							if (isProjectFile(resolved)) {
								candidates.push(resolved);
							}
						}
					}
				}
			}

			// Validate all candidate files synchronously
			for (const p of candidates) {
				if (canOpenFile(p)) {
					addPath(p);
				} else {
					logger?.debug(`Skipping project path '${p}' - file not accessible or does not exist.`);
				}
			}
		} catch (e: unknown) {
			logger?.debug(`Failed to read solution file '${slnPath}' - ${formatUnknownError(e)}.`);
		}
	}

	return Array.from(projectPaths);
};
