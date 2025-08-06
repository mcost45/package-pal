import type {
	CommandContext, TypedCommandFlagParameters,
} from '@stricli/core';

export interface CommonFlags { config?: string }

export const commonParameters: TypedCommandFlagParameters<Readonly<CommonFlags>, CommandContext> = { flags: { config: {
	kind: 'parsed',
	parse: String,
	brief: 'Override config file path',
	optional: true,
} } };
