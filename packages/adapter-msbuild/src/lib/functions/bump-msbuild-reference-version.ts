import { parse } from 'txml/txml';
import type { TNode } from 'txml/txml';
import { escapeXml } from './escape-xml.ts';
import { stringifyMsbuild } from './stringify-msbuild.ts';

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
				if (node.tagName.toLowerCase() === 'packagereference') {
					const keys = Object.keys(node.attributes);
					const includeKey = keys.find(k => k.toLowerCase() === 'include');
					const updateKey = keys.find(k => k.toLowerCase() === 'update');
					const includeVal = includeKey ? node.attributes[includeKey] : undefined;
					const updateVal = updateKey ? node.attributes[updateKey] : undefined;

					if (includeVal === packageName || updateVal === packageName) {
						const versionAttrKey = keys.find(k => k.toLowerCase() === 'version');
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

		if (target.type === 'attribute') {
			const key = target.versionKey;
			if (key && target.node.attributes[key] !== bumpedVersion) {
				target.node.attributes[key] = bumpedVersion;
				modified = true;
			}
		} else {
			const vChild = target.versionChild;
			const idx = target.textChildIndex;
			const escaped = escapeXml(bumpedVersion);
			if (vChild && idx !== undefined && vChild.children[idx] !== escaped) {
				vChild.children[idx] = escaped;
				modified = true;
			}
		}
	}

	if (modified && foundVersion) {
		const updatedRaw = stringifyMsbuild(dom);
		return {
			updatedRaw,
			currentVersion: foundVersion,
		};
	}

	return undefined;
};
