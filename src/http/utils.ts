export type Class<T, Args extends any[] = any[]> = {
  new (...args: Args) : T;
};

export type Expand<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
