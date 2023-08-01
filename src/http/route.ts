import type { ServerResponse } from "node:http";
import type { Resolver } from "awilix";
import type { HTTPMethod } from "find-my-way";
import type { TAnyMiddleware } from "./middleware.js";
import type { TRequest } from "./request.js";
import type { TResponse } from "./response.js";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TQueryStringRestriction,
  TServicesRestriction,
} from "./schema.js";

export type TAnyRoute = Route<any, any, any, any, any, any>;

export function route<
  TBody extends TBodyRestriction,
  TQueryString extends TQueryStringRestriction,
  THeader extends THeaderRestriction,
  TCookie extends TCookieRestriction,
  TFile extends TFileRestriction,
  TServices extends TServicesRestriction
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
  TBody extends TBodyRestriction = TBodyRestriction,
  TQueryString extends TQueryStringRestriction = {},
  THeader extends THeaderRestriction = {},
  TCookie extends TCookieRestriction = {},
  TFile extends TFileRestriction = {},
  TServices extends TServicesRestriction = TServicesRestriction
> {
  _url: string;
  _method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  _body?: TBody;
  _header?: THeader;
  _queryString?: TQueryString;
  _cookie?: TCookie;
  _file?: TFile;
  _fileOptions?: TFileOptions;

  _services?: string[];
  _middlewares?: TAnyMiddleware[];
  _inject: Record<string, Resolver<unknown>> = {};

  _handler: (
    req: TRequest<TBody, TQueryString, THeader, TCookie, TFile>,
    res: TResponse,
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
    this._url = options.url;
    this._method = options.method;

    this._body = options.body;
    this._queryString = options.queryString;
    this._header = options.header;
    this._cookie = options.cookie;
    this._file = options.file;

    this._fileOptions = options.fileProcessingOptions;

    this._middlewares = options.middlewares;

    this._handler = options.handler;
  }
}

export type TRouteCreationOptions<
  TBody extends TBodyRestriction,
  TQueryString extends TQueryStringRestriction,
  THeader extends THeaderRestriction,
  TCookie extends TCookieRestriction,
  TFile extends TFileRestriction,
  TServices extends TServicesRestriction
> = {
  url: string;
  method: HTTPMethod | Lowercase<HTTPMethod> | (string & {});

  body?: TBody;
  queryString?: TQueryString;
  header?: THeader;
  cookie?: TCookie;

  file?: TFile;
  fileProcessingOptions?: TFile extends undefined ? never : TFileOptions;

  middlewares?: TAnyMiddleware[];
  handler: (
    req: TRequest<TBody, TQueryString, THeader, TCookie, TFile>,
    res: ServerResponse,
    ...services: TServices
  ) => unknown | void;
};

type TFileOptions = {
  preservePath?: boolean;
};

