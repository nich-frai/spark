export type Class<T, Args extends ClassConstructorArgs = []> = {
  new (...args: Args) : T;
};

type ClassConstructorArgs =
  | []
  | [unknown]
  | [unknown, unknown]
  | [unknown, unknown, unknown];
