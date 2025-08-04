export type SubprocessCallback<T> = (props: T) => string | Promise<string | undefined> | undefined;
