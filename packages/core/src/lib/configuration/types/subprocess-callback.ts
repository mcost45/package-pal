// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type SubprocessCallback<T> = (props: T) => string | Promise<string | undefined | void> | void;
