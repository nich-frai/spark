import type { Resolver } from "awilix";
import type { TErrorHandler } from "./http_error.js";
import type { TRequest } from "./request.js";
import type { HTTPResponse } from "./response.js";
import type {
  TRouteSchema,
  TServicesSchema
} from "./schema.js";

export interface TRequestMiddleware<
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

export interface TResponseMiddleware {
  handle(
    response: HTTPResponse
  ): HTTPResponse | Error | Promise<HTTPResponse | Error>;
}

type TRegisterDependency = {
  registerDependency(name: string, provider: Resolver<unknown>): void;
  registerDependency(register: Record<string, Resolver<unknown>>): void;
};

export type TAnyRequestMiddleware = TRequestMiddleware<any, any>;

export function requestMiddleware() {}


