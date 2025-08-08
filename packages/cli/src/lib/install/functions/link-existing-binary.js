import {
	copyFileSync, existsSync, linkSync, symlinkSync, unlinkSync,
} from 'fs';

/**
 * @param {{ platform: Bun.Platform, targetBinPath: string, outputBinPath: string }} options
 */
export const linkExistingBinary = ({
	platform, targetBinPath, outputBinPath,
}) => {
	const isWin = platform === 'win32';

	/**
	 *  @param {string | undefined} method
	 */
	const verifyLinked = (method) => {
		if (!existsSync(outputBinPath)) {
			throw new Error(`Expected link not found${method ? ` after ${method}` : ''}: '${outputBinPath}'.`);
		}
	};

	const errs = [];

	try {
		unlinkSync(outputBinPath);
	} catch (e) {
		errs.push(e);
	}

	if (!isWin) {
		try {
			symlinkSync(targetBinPath, outputBinPath);
			verifyLinked('symlinkSync');

			return;
		} catch (eSymlinkSync) {
			errs.push(eSymlinkSync);
		}
	}

	try {
		linkSync(targetBinPath, outputBinPath);
		verifyLinked('linkSync');
	} catch (eLinkSync) {
		errs.push(eLinkSync);

		try {
			copyFileSync(targetBinPath, outputBinPath);
			verifyLinked('copyFileSync');
		} catch (eCopyFileSync) {
			errs.push(eCopyFileSync);
		}
	}

	try {
		verifyLinked(undefined);
	} catch {
		throw new Error('Unable to link CLI binary.', { cause: errs });
	}

	console.info(`Successfully linked binary: '${outputBinPath}' → '${targetBinPath}'.`);
};
