import type { Prettify } from '@package-pal/util';
import type { SpawnOptions } from 'bun';

export type SpawnOptions<
	In extends SpawnOptions.Writable = 'ignore',
	Out extends SpawnOptions.Readable = 'pipe',
	Err extends SpawnOptions.Readable = 'inherit',
> = Prettify<Omit<SpawnOptions.OptionsObject<In, Out, Err>, 'signal' | 'stdio' | 'stdout' | 'stderr'>>;
