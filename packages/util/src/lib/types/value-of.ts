export type ValueOf<T> = T extends unknown[] ? (T extends (infer U)[] ? U : never) : T[keyof T];
