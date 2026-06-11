import {
	openSync, closeSync, realpathSync,
} from 'fs';
import {
	dirname, resolve, extname, isAbsolute,
} from 'path';
import type { Logger } from '@package-pal/core';
import {
	normalisePath, formatUnknownError,
} from '@package-pal/util';
import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';

const canOpenFile = (filePath: string): boolean => {
	let fd: number | undefined;
	try {
		fd = openSync(filePath, 'r');
		return true;
	} catch {
		return false;
	} finally {
		if (fd !== undefined) {
			try {
				closeSync(fd);
			} catch {
				// Ignore errors on close
			}
		}
	}
};

const isProjectFile = (filePath: string): boolean => {
	const ext = extname(filePath).toLowerCase();
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

const findSlnxProjects = (
	nodes: (TNode | string)[], slnDir: string, logger?: Logger,
): string[] => {
	const paths: string[] = [];

	const traverse = (node: TNode | string) => {
		if (typeof node === 'object') {
			const attrs = node.attributes;
			// Check common attribute names for paths
			const pathValue = attrs.Path ?? attrs.path ?? attrs.Include ?? attrs.include ?? attrs.Update ?? attrs.update;
			if (pathValue) {
				const resolved = resolveSlnPath(slnDir, pathValue);
				if (isProjectFile(resolved)) {
					if (canOpenFile(resolved)) {
						paths.push(resolved);
					} else {
						logger?.debug(`Skipping project path '${resolved}' - file not accessible or does not exist.`);
					}
				}
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}
	};

	for (const node of nodes) {
		traverse(node);
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
			const text = await file.text();
			const isSlnx = extname(slnPath).toLowerCase() === '.slnx';

			if (isSlnx) {
				const dom = parse(text);
				const resolvedPaths = findSlnxProjects(
					dom, slnDir, logger,
				);
				for (const path of resolvedPaths) {
					addPath(path);
				}
			} else {
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
								if (canOpenFile(resolved)) {
									addPath(resolved);
								} else {
									logger?.debug(`Skipping project path '${resolved}' - file not accessible or does not exist.`);
								}
							}
						}
					}
				}
			}
		} catch (e: unknown) {
			logger?.debug(`Failed to read solution file '${slnPath}' - ${formatUnknownError(e)}.`);
		}
	}

	return Array.from(projectPaths);
};
