export const getCommandsForShell = (shellCommand: string) => {
	const isWindows = process.platform === 'win32';

	if (!isWindows) {
		return [
			'sh',
			'-c',
			`"${shellCommand}"`,
		];
	}

	const shell = Bun.which('pwsh') ? 'pwsh' : (Bun.which('powershell') ? 'powershell' : 'cmd');

	if (shell === 'cmd') {
		return [
			shell,
			'/c',
			`"${shellCommand}"`,
		];
	}

	const encodedCommand = Buffer.from(shellCommand, 'utf16le').toString('base64');

	return [
		shell,
		'-EncodedCommand',
		encodedCommand,
	];
};
