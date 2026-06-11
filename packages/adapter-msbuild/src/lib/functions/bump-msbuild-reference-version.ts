import type { Logger } from '@package-pal/core';
import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { escapeXml } from './escape-xml.ts';
import {
	stringifyMsbuild, detectSelfClosingSpace,
} from './stringify-msbuild.ts';

const isWritableVersion = (v: string): boolean => {
	const s = v.trim();

	if (!s) return false;

	// explicitly non-writable MSBuild constructs
	if (
		s.includes('$') // MSBuild property
		|| s.includes('*') // wildcards
		|| s.includes('[') // version ranges
		|| s.includes(']')
		|| s.includes(',')
		|| s.includes('|')
	) return false;

	// allow only simple semver-ish OR prefixed forms
	return /^[~^]?\d+(\.\d+){1,2}([-+][a-zA-Z0-9.-]+)?$/.test(s)
		|| /^workspace:/i.test(s);
};

const getUpdatedVersion = (
	currentVersion: string,
	bumpedVersion: string,
	exact: boolean,
): string => {
	if (exact) {
		return bumpedVersion;
	}

	// Try to match standard semver (including pre-release and metadata) at the end of currentVersion
	const match = /(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)$/.exec(currentVersion);
	if (match?.[1]) {
		const matchedVersion = match[1];
		const prefix = currentVersion.slice(0, -matchedVersion.length);
		return `${prefix}${bumpedVersion}`;
	}

	if (currentVersion.startsWith('workspace:^')) {
		return `workspace:^${bumpedVersion}`;
	}
	if (currentVersion.startsWith('workspace:~')) {
		return `workspace:~${bumpedVersion}`;
	}
	if (currentVersion.startsWith('workspace:')) {
		return `workspace:^${bumpedVersion}`;
	}
	if (currentVersion.startsWith('^')) {
		return `^${bumpedVersion}`;
	}
	if (currentVersion.startsWith('~')) {
		return `~${bumpedVersion}`;
	}
	return `^${bumpedVersion}`;
};

interface TargetRef {
	node: TNode;
	type: 'attribute' | 'child';
	versionKey?: string;
	versionChild?: TNode;
	textChildIndex?: number;
	currentVersion: string;
}

export const bumpMsbuildReferenceVersion = (
	dependentRaw: string,
	packageName: string,
	bumpedVersion: string,
	exact = true,
	logger?: Logger,
	updatePackageName?: string,
): {
	updatedRaw: string;
	currentVersion: string;
} | undefined => {
	const dom = parse(dependentRaw, {
		keepComments: true,
		keepWhitespace: true,
	});

	const targets: TargetRef[] = [];

	const collectTargets = (nodes: (TNode | string)[]) => {
		for (const node of nodes) {
			if (node && typeof node === 'object') {
				const tagName = node.tagName.toLowerCase();
				if (tagName === 'packagereference' || tagName === 'packageversion') {
					let includeKey: string | undefined;
					let updateKey: string | undefined;
					let versionAttrKey: string | undefined;

					for (const key in node.attributes) {
						const lowerKey = key.toLowerCase();
						if (lowerKey === 'include') {
							includeKey = key;
						} else if (lowerKey === 'update') {
							updateKey = key;
						} else if (lowerKey === 'version') {
							versionAttrKey = key;
						}
					}

					const includeVal = includeKey ? node.attributes[includeKey] : undefined;
					const updateVal = updateKey ? node.attributes[updateKey] : undefined;

					if (includeVal === packageName || updateVal === packageName) {
						if (versionAttrKey) {
							const currentVersion = node.attributes[versionAttrKey];
							if (currentVersion && isWritableVersion(currentVersion)) {
								targets.push({
									node,
									type: 'attribute',
									versionKey: versionAttrKey,
									currentVersion,
								});
							}
						} else {
							const versionChildIndex = node.children.findIndex(child => child && typeof child === 'object' && child.tagName.toLowerCase() === 'version');
							if (versionChildIndex !== -1) {
								const versionChild = node.children[versionChildIndex] as TNode;
								const textChildIndex = versionChild.children.findIndex(c => typeof c === 'string');
								if (textChildIndex !== -1) {
									const currentVersion = versionChild.children[textChildIndex] as string;
									if (isWritableVersion(currentVersion)) {
										targets.push({
											node,
											type: 'child',
											versionChild,
											textChildIndex,
											currentVersion,
										});
									}
								}
							}
						}
					}
				}
				collectTargets(node.children);
			}
		}
	};

	collectTargets(dom);

	let foundVersion: string | undefined = undefined;
	let modified = false;

	for (const target of targets) {
		foundVersion ??= target.currentVersion;
		const targetBumpedVersion = getUpdatedVersion(
			target.currentVersion, bumpedVersion, exact,
		);

		if (target.type === 'attribute') {
			const key = target.versionKey;
			if (key && target.node.attributes[key] !== targetBumpedVersion) {
				if (logger && updatePackageName) {
					logger.info(`Updating '${updatePackageName}' ${target.node.tagName} '${packageName}': ${target.currentVersion} → ${targetBumpedVersion}.`);
				}
				target.node.attributes[key] = targetBumpedVersion;
				modified = true;
			}
		} else {
			const vChild = target.versionChild;
			const idx = target.textChildIndex;
			const escaped = escapeXml(targetBumpedVersion);
			if (vChild && idx !== undefined && vChild.children[idx] !== escaped) {
				if (logger && updatePackageName) {
					logger.info(`Updating '${updatePackageName}' ${target.node.tagName} '${packageName}': ${target.currentVersion} → ${targetBumpedVersion}.`);
				}
				vChild.children[idx] = escaped;
				modified = true;
			}
		}
	}

	if (modified && foundVersion) {
		const selfClosingSpace = detectSelfClosingSpace(dependentRaw);
		const updatedRaw = stringifyMsbuild(dom, { selfClosingSpace });
		return {
			updatedRaw,
			currentVersion: foundVersion,
		};
	}

	return undefined;
};
