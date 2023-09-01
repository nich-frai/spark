import type { Resolver } from "awilix";
import type { HTTPMethod } from "find-my-way";
import type { TErrorHandler } from "./http_error.js";
import type {
  TAnyRequestMiddleware,
} from "./middleware.js";
import type { TRequest } from "./request.js";
import type {
  TRouteSchema,
  TServicesSchema
} from "./schema.js";

export type TAnyRoute = Route<any, any>;

export function route<
  TSchema extends TRouteSchema,
  TServices extends TServicesSchema
>(options: TRouteCreationOptions<TSchema, TServices>) {
  return new Route(options);
}

export type TRouteCreationOptionsShort<
  TSchema extends TRouteSchema,
  TServices extends TServicesSchema
> = Omit<TRouteCreationOptions<TSchema, TServices>, "url" | "method"> & {};

export class Route<
  TSchema extends TRouteSchema,
  TServices extends TServicesSchema
> {
  url: string;
  method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  schema?: TSchema;
  fileOptions?: TFileOptions;

  requestMiddleware?: TAnyRequestMiddleware[];
  errorHandler?: TErrorHandler[];

  inject: Record<string, Resolver<unknown>> = {};

  handler: (req: TRequest<TSchema>, ...services: TServices) => unknown | void;

  constructor(options: TRouteCreationOptions<TSchema, TServices>) {
    this.url = options.url;
    this.method = options.method;

    this.schema = options.schema;

    this.fileOptions = options.fileProcessingOptions;

    this.requestMiddleware = options.requestMiddleware;
    this.errorHandler = options.errorHandler;

    this.handler = options.handler;
  }
}

export interface TRouteCreationOptions<
  TSchema extends TRouteSchema = TRouteSchema,
  TServices extends TServicesSchema = [unknown]
> {
  url: string;
  method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  schema?: TSchema;
  fileProcessingOptions?: TSchema["files"] extends NonNullable<TSchema["files"]>
    ? TFileOptions
    : never;

  requestMiddleware?: TAnyRequestMiddleware[];
  errorHandler?: TErrorHandler[];

  configure?: TConfigureRoute;

  handler: (req: TRequest<TSchema>, ...services: TServices) => unknown | void;
}

type TFileOptions = {
  preservePath?: boolean;
  uploadDir?: string;
};

export interface TConfigureRoute {
  maxBodySize?: number;
}
