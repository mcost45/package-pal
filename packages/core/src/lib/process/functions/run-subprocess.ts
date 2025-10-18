import { styleText } from 'node:util';
import type { Logger } from '../../configuration/types/logger.ts';
import { ExitState } from '../types/exit-state.ts';
import { StdType } from '../types/std-type.ts';
import { getCommandsForShell } from './get-commands-for-shell.ts';
import { getLineBufferedWriter } from './get-line-buffered-writer.ts';
import { readStream } from './read-stream.ts';

const sigintCode = 130;
const sigtermCode = 143;
const sigkillCode = 137;
const cancelCodes = new Set([
	sigintCode,
	sigtermCode,
	sigkillCode,
]);

export const runSubprocess = async (opts: {
	debugName: string;
	shellCommand: string;
	cwd?: string;
	signal?: AbortSignal;
	logger: Logger;
	onStdChunk?: (chunk: string, type: StdType) => void;
}) => {
	if (opts.signal?.aborted) {
		opts.logger.debug(styleText('dim', `Skipped '${opts.debugName}' subprocess command; signal already cancelled.`));
		return ExitState.Cancelled;
	}

	const commands = getCommandsForShell(opts.shellCommand);
	const baseSubprocessOpts = {
		stdout: 'pipe',
		stderr: 'pipe',
		stdin: 'ignore',
	} as const;
	const subprocessOpts = {
		...baseSubprocessOpts,
		...(opts.cwd ? { cwd: opts.cwd } : {}),
		...(opts.signal ? { signal: opts.signal } : {}),
	};

	const subprocess = Bun.spawn(commands, subprocessOpts);
	const pid = subprocess.pid.toString();
	const minPrefixLen = 14;

	const [readStdout, readStderr] = (
		[{
			source: subprocess.stdout,
			type: StdType.Out,
			write: getLineBufferedWriter(styleText('dim', `[O-${pid}]`.padEnd(minPrefixLen, ' '))),
		}, {
			source: subprocess.stderr,
			type: StdType.Err,
			write: getLineBufferedWriter(styleText('yellow', styleText('dim', `[E-${pid}]`.padEnd(minPrefixLen, ' ')))),
		}] as const
	).map(({
		source, type, write,
	}) => {
		return readStream(source, (chunk) => {
			write(chunk);

			if (opts.onStdChunk) {
				opts.onStdChunk(chunk, type);
			}
		});
	}) as [Promise<void>, Promise<void>];

	const executedCommand = commands.join(' ');
	opts.logger.debug(styleText('dim', `Started '${opts.debugName}' subprocess command '${opts.shellCommand}' (${executedCommand}) with PID ${pid}.`));

	const [
		,,exitState,
	] = await Promise.all([
		readStdout,
		readStderr,
		subprocess.exited.then((exitCode) => {
			if (cancelCodes.has(exitCode)) {
				opts.logger.debug(styleText('dim', `Cancelled '${opts.debugName}' subprocess command; PID ${pid} exited.`));
				return ExitState.Cancelled;
			}

			if (exitCode !== 0) {
				opts.logger.error(styleText('red', `'${opts.debugName}' command '${opts.shellCommand}' (${executedCommand}) with PID ${pid} failed with exit code ${exitCode.toString()}.`));
				return ExitState.Errored;
			}

			opts.logger.debug(styleText('dim', `Completed '${opts.debugName}' subprocess command; PID ${pid} exited.`));
			return ExitState.Completed;
		}),
	]);

	return exitState;
};
