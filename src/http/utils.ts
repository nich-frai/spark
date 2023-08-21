export type Class<T, Args extends any[] = any[]> = {
  new (...args: Args) : T;
};
