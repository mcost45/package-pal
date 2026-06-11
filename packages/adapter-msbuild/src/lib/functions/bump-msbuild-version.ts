import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { escapeXml } from './escape-xml.ts';
import { stringifyMsbuild } from './stringify-msbuild.ts';

const hasCondition = (node: TNode): boolean => {
	return Object.keys(node.attributes).some(k => k.toLowerCase() === 'condition');
};

const isRootPropertyGroup = (node: TNode): boolean => {
	return node.tagName.toLowerCase() === 'propertygroup'
		&& !hasCondition(node);
};

export const bumpMsbuildVersion = (raw: string, bumpedVersion: string): string => {
	const dom = parse(raw, {
		keepComments: true,
		keepWhitespace: true,
	});

	const versionNodes: TNode[] = [];
	const versionPrefixNodes: TNode[] = [];
	const versionSuffixNodes: TNode[] = [];
	const propertyGroups: TNode[] = [];
	const projects: TNode[] = [];

	const collect = (nodes: (TNode | string)[]) => {
		for (const node of nodes) {
			if (node && typeof node === 'object') {
				const tagLower = node.tagName.toLowerCase();
				if (tagLower === 'version' && !hasCondition(node)) {
					versionNodes.push(node);
				} else if (tagLower === 'versionprefix' && !hasCondition(node)) {
					versionPrefixNodes.push(node);
				} else if (tagLower === 'versionsuffix' && !hasCondition(node)) {
					versionSuffixNodes.push(node);
				} else if (tagLower === 'propertygroup') {
					propertyGroups.push(node);
				} else if (tagLower === 'project') {
					projects.push(node);
				}
				collect(node.children);
			}
		}
	};

	collect(dom);

	if (versionNodes.length > 0) {
		// Prefer <Version> over prefix/suffix ONLY if unambiguous
		for (const node of versionNodes) {
			node.children = [escapeXml(bumpedVersion)];
		}
	} else if (versionPrefixNodes.length > 0 && versionSuffixNodes.length > 0) {
		// If BOTH unconditional Prefix + Suffix exist -> update them, DO NOT mix strategies
		const dashIndex = bumpedVersion.indexOf('-');
		const prefix = dashIndex !== -1 ? bumpedVersion.slice(0, dashIndex) : bumpedVersion;
		const suffix = dashIndex !== -1 ? bumpedVersion.slice(dashIndex + 1) : '';

		for (const node of versionPrefixNodes) {
			node.children = [escapeXml(prefix)];
		}
		for (const node of versionSuffixNodes) {
			node.children = suffix ? [escapeXml(suffix)] : [];
		}
	} else if (versionPrefixNodes.length > 0) {
		// If only Prefix exists -> update it with full version
		for (const node of versionPrefixNodes) {
			node.children = [escapeXml(bumpedVersion)];
		}
	} else {
		// Fallback insert
		const targetPG = propertyGroups.find(isRootPropertyGroup) ?? propertyGroups[0];
		if (targetPG) {
			// Make insertion idempotent (unconditional only)
			const hasUnconditionalVersionInGroup = targetPG.children.some(n => typeof n === 'object' && n.tagName.toLowerCase() === 'version' && !hasCondition(n));

			if (!hasUnconditionalVersionInGroup) {
				const versionNode: TNode = {
					tagName: 'Version',
					attributes: {},
					children: [escapeXml(bumpedVersion)],
				};

				let indent = '\n  ';
				if (targetPG.children.length > 0 && typeof targetPG.children[0] === 'string') {
					const match = /^[\r\n\s]+$/.exec(targetPG.children[0]);
					if (match) {
						indent = targetPG.children[0];
					}
				}

				if (targetPG.children.length > 0) {
					const lastChild = targetPG.children[targetPG.children.length - 1];
					if (typeof lastChild === 'string' && /^[\r\n\s]+$/.test(lastChild)) {
						targetPG.children.splice(
							targetPG.children.length - 1, 0, indent, versionNode,
						);
					} else {
						targetPG.children.push(indent, versionNode);
					}
				} else {
					targetPG.children.push(
						indent, versionNode, '\n',
					);
				}
			}
		} else {
			// No PropertyGroup found, look for Project
			const targetProject = projects[0];
			if (targetProject) {
				const versionNode: TNode = {
					tagName: 'Version',
					attributes: {},
					children: [escapeXml(bumpedVersion)],
				};
				const pgNode: TNode = {
					tagName: 'PropertyGroup',
					attributes: {},
					children: [
						'\n    ',
						versionNode,
						'\n  ',
					],
				};

				let indent = '\n  ';
				if (targetProject.children.length > 0 && typeof targetProject.children[0] === 'string') {
					const match = /^[\r\n\s]+$/.exec(targetProject.children[0]);
					if (match) {
						indent = targetProject.children[0];
					}
				}

				if (targetProject.children.length > 0) {
					const lastChild = targetProject.children[targetProject.children.length - 1];
					if (typeof lastChild === 'string' && /^[\r\n\s]+$/.test(lastChild)) {
						targetProject.children.splice(
							targetProject.children.length - 1, 0, indent, pgNode,
						);
					} else {
						targetProject.children.push(indent, pgNode);
					}
				} else {
					targetProject.children.push(
						indent, pgNode, '\n',
					);
				}
			}
		}
	}

	return stringifyMsbuild(dom);
};
