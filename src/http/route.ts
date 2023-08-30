import type { Resolver } from "awilix";
import type { HTTPMethod } from "find-my-way";
import type {
  TAnyRequestMiddleware,
  TAnyResponseMiddleware,
} from "./middleware.js";
import type { TRequest } from "./request.js";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TQueryStringRestriction,
  TServicesRestriction,
} from "./schema.js";
import type { TErrorHandler } from "./http_error.js";

export type TAnyRoute = Route<any, any, any, any, any, any>;

export function route<
  TBody extends TBodyRestriction = Record<string, never>,
  TQueryString extends TQueryStringRestriction = Record<string, never>,
  THeader extends THeaderRestriction = Record<string, never>,
  TCookie extends TCookieRestriction = Record<string, never>,
  TFile extends TFileRestriction = Record<string, never>,
  TServices extends TServicesRestriction = [unknown]
>(
  options: TRouteCreationOptions<
    TBody,
    TQueryString,
    THeader,
    TCookie,
    TFile,
    TServices
  >
) {
  return new Route(options);
}

export type TRouteCreationOptionsShort<
  TBody extends TBodyRestriction,
  TQueryString extends TQueryStringRestriction,
  THeader extends THeaderRestriction,
  TCookie extends TCookieRestriction,
  TFile extends TFileRestriction,
  TServices extends TServicesRestriction
> = Omit<
  TRouteCreationOptions<
    TBody,
    TQueryString,
    THeader,
    TCookie,
    TFile,
    TServices
  >,
  "url" | "method"
> & {};

export class Route<
  TBody extends TBodyRestriction,
  TQueryString extends TQueryStringRestriction,
  THeader extends THeaderRestriction,
  TCookie extends TCookieRestriction,
  TFile extends TFileRestriction,
  TServices extends TServicesRestriction
> {
  url: string;
  method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  body?: TBody;
  header?: THeader;
  queryString?: TQueryString;
  cookie?: TCookie;
  file?: TFile;
  fileOptions?: TFileOptions;

  requestMiddleware?: TAnyRequestMiddleware[];
  responseMiddleware?: TAnyResponseMiddleware[];
  errorHandler?: TErrorHandler[];

  inject: Record<string, Resolver<unknown>> = {};

  handler: (
    req: TRequest<TBody, TQueryString, THeader, TCookie, TFile>,
    ...services: TServices
  ) => unknown | void;

  constructor(
    options: TRouteCreationOptions<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    this.url = options.url;
    this.method = options.method;

    this.body = options.body;
    this.queryString = options.queryString;
    this.header = options.header;
    this.cookie = options.cookie;
    this.file = options.file;

    this.fileOptions = options.fileProcessingOptions;

    this.requestMiddleware = options.requestMiddleware;
    this.responseMiddleware = options.responseMiddleware;
    this.errorHandler = options.errorHandler;

    this.handler = options.handler;
  }
}

export interface TRouteCreationOptions<
  TBody extends TBodyRestriction = Record<string, never>,
  TQueryString extends TQueryStringRestriction = Record<string, never>,
  THeader extends THeaderRestriction = Record<string, never>,
  TCookie extends TCookieRestriction = Record<string, never>,
  TFile extends TFileRestriction = Record<string, never>,
  TServices extends TServicesRestriction = [unknown]
> {
  url: string;
  method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  body?: TBody;
  queryString?: TQueryString;
  header?: THeader;
  cookie?: TCookie;
  file?: TFile;
  fileProcessingOptions?: TFile extends undefined ? never : TFileOptions;

  requestMiddleware?: TAnyRequestMiddleware[];
  responseMiddleware?: TAnyResponseMiddleware[];
  errorHandler?: TErrorHandler[];

  configure?: TConfigureRoute;

  handler: (
    req: TRequest<TBody, TQueryString, THeader, TCookie, TFile>,
    ...services: TServices
  ) => unknown | void;
}

type TFileOptions = {
  preservePath?: boolean;
  uploadDir?: string;
};

export interface TConfigureRoute {
  maxBodySize?: number;
}

