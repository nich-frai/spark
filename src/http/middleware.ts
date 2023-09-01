import type { Resolver } from "awilix";
import type { TErrorHandler } from "./http_error.js";
import type { TRequest } from "./request.js";
import type { HTTPResponse } from "./response.js";
import type {
  TMiddlewareSchema,
  TRouteSchema,
  TServicesSchema
} from "./schema.js";

export interface TMiddleware<
  TSchema extends TRouteSchema,
  TServices extends TServicesSchema
> {
  // schema
  schema?: TSchema;

  // injections
  inject?: Record<string, Resolver<unknown>>;

  errorHandlers?: TErrorHandler | TErrorHandler[];

  handle(
    req: TRequest<TSchema> & TRegisterDependency,
    ...services: TServices
  ): unknown | void | Error | HTTPResponse | Promise<Error | HTTPResponse>;
}

type TRegisterDependency = {
  registerDependency(name: string, provider: Resolver<unknown>): void;
  registerDependency(register: Record<string, Resolver<unknown>>): void;
};

export type TAnyMiddleware = TMiddleware<any, any>;

export function requestMiddleware<
  TSchema extends TMiddlewareSchema,
  TServices extends TServicesSchema
>(options : TMiddleware<TSchema, TServices>) {
  return options;
}


