import { chmodSync } from 'fs';
import { get } from 'https';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { x } from 'tar';
import packageJson from '../../../../package.json' with { type: 'json' };

const maxAttempts = 5;
const initialBackoffMs = 500;

/**
 * @param {string} tarballUrl
 * @param {string} binExecutableName
 * @param {string} outputBinDir
 */
const tryDownloadAndExtract = (
	tarballUrl, binExecutableName, outputBinDir,
) => {
	return new Promise((resolve, reject) => {
		get(tarballUrl, (res) => {
			const isRedirect = res.statusCode && (res.statusCode >= 300
				&& res.statusCode < 400);
			const isSuccess = res.statusCode === 200;

			if (isRedirect) {
				if (!res.headers.location) {
					reject(new Error(`Failed to download binary: Redirect location missing.`));
					return;
				}
				downloadAndExtract(
					res.headers.location, binExecutableName, outputBinDir,
				)
					.then(resolve)
					.catch(reject);
				return;
			}

			if (!isSuccess) {
				reject(new Error(`Failed to download binary: ${res.statusCode?.toString() ?? 'Unknown'}`));
				return;
			}

			const extractStream = x({
				cwd: outputBinDir,
				strip: 1,
				filter: path => path === `package/bin/${binExecutableName}`,
			});

			pipeline(res, extractStream).then(resolve)
				.catch(reject);
		}).on('error', reject);
	});
};

/**
 * @param {string} tarballUrl
 * @param {string} binExecutableName
 * @param {string} outputBinDir
 */
const downloadAndExtract = async (
	tarballUrl, binExecutableName, outputBinDir,
) => {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await tryDownloadAndExtract(
				tarballUrl, binExecutableName, outputBinDir,
			);
			return;
		} catch (error) {
			if (attempt < maxAttempts) {
				const delay = initialBackoffMs * 2 ** (attempt - 1);
				console.warn(`Download failed (attempt ${attempt.toString()}), retrying in ${delay.toString()}ms...`);
			} else {
				throw error;
			}
		}
	}

	try {
		chmodSync(join(outputBinDir, binExecutableName), 0o755);
	} catch {
		//
	}
};

/**
 * @param {{ binExecutableName: string, targetPackage: string, outputBinDir: string }} options
 */
export const loadMissingBinary = async ({
	binExecutableName, targetPackage, outputBinDir,
}) => {
	const fullTargetPackageName = `@package-pal/${targetPackage}`;
	/** @type {Record<string, string>} */
	const optionalDeps = packageJson.optionalDependencies;
	const targetPackageVersion = optionalDeps[fullTargetPackageName];

	if (!targetPackageVersion) {
		throw new Error(`No version found for target package '${fullTargetPackageName}'.`);
	}

	const tarballUrl = `https://registry.npmjs.org/${fullTargetPackageName}/-/${targetPackage}-${targetPackageVersion}.tgz`;
	console.info(`Downloading '${fullTargetPackageName}' into '${outputBinDir}' from ${tarballUrl}...`);

	await downloadAndExtract(
		tarballUrl, binExecutableName, outputBinDir,
	);
};
