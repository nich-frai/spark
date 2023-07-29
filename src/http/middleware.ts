import type { Class, JsonValue } from "type-fest";
import type {
  TRequestBody,
  TRequestCookies,
  TRequestHeaders,
  TRequestQueryParams,
  TRequestType,
  TRequestURLParams,
} from "./request.js";
import { HTTPResponse } from "./response.js";
import { BadGateway, BadRequest, Unauthorized } from "./http_error.js";

export type HTTPRequestMiddleware<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined
> =
  | IHTTPRequestMiddleware<Body, Headers, Cookies, URLParams, QueryParams>
  | THTTPRequestMiddlewareFn<Body, Headers, Cookies, URLParams, QueryParams>;

export type HTTPResponseMiddleware =
  | IHTTPResponseMiddleware
  | THTTPResponseMiddlewareFn;

interface IHTTPRequestMiddleware<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[]
> {
  name: string;

  body?: Body;
  headers?: Headers;
  cookies?: Cookies;
  urlParams?: URLParams;
  queryParams?: QueryParams;

  interceptor: THTTPRequestMiddlewareFn<
    Body,
    Headers,
    Cookies,
    URLParams,
    QueryParams,
    Services
  >;

  provide?: {
    [name: string]: Class<unknown> | ((...args: any) => any) | JsonValue;
  };
}

interface IHTTPResponseMiddleware {
  name: string;
  interceptor: THTTPResponseMiddlewareFn;
  // interceptWhen?: TResponseInterceptionMoment | TResponseInterceptionMoment[];
}

export type THTTPErrorGenerationMoment =
  | "data-validation-failed"
  | "interceptor-prevented-progression"
  | "interceptor-prevented-progression-with-ok-response"
  | "interceptor-prevented-progression-with-error-response"
  | "guard-prevented-progression"
  | "handler-finished"
  | "handler-finished-with-ok-response"
  | "handler-finished-with-error-response"
  | "before-writing-to-client"
  | "always";

export type THTTPRequestMiddlewareFn<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[]
> = (
  req: TRequestType<Body, Headers, Cookies, URLParams, QueryParams>,
  ...services: Services
) =>
  | TRequestType<Body, Headers, Cookies, URLParams, QueryParams>
  | HTTPResponse
  | Error
  | Promise<
      | TRequestType<Body, Headers, Cookies, URLParams, QueryParams>
      | HTTPResponse
      | Error
    >;

export type THTTPResponseMiddlewareFn<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[]
> = (
  res: HTTPResponse,
  req: TRequestType<Body, Headers, Cookies, URLParams, QueryParams>,
  ...services: Services
) => HTTPResponse | Promise<HTTPResponse>;

export function requestMiddleware<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[]
>(
  options: IHTTPRequestMiddleware<
    Body,
    Headers,
    Cookies,
    URLParams,
    QueryParams,
    Services
  >
) {
  const g: IHTTPRequestMiddleware<
    Body,
    Headers,
    Cookies,
    URLParams,
    QueryParams,
    Services
  > = {
    ...options,
  };
  return g;
}

export interface HTTPErrorHandler<
  E extends THandleError | Class<Error> = Class<Error>
> {
  handles?: E;
  handler: TErrorHandlerFn<E>;
}

const a = errorHandler([Unauthorized, BadRequest, BadGateway], (e) => {
  return HTTPResponse.ok("");
});

const b = errorHandler((e) => {
  return HTTPResponse.error(e);
});

type THandleError = Class<Error> | [Class<Error>, ...Class<Error>[]];

type TErrorHandlerFn<T extends THandleError = Class<Error>> = (
  handler: T extends Class<Error>
    ? InstanceType<T>
    : T extends [Class<Error>, ...Class<Error>[]]
    ? InstanceType<T[number]>
    : Error
) => HTTPResponse;

export function errorHandler(handler: TErrorHandlerFn): HTTPErrorHandler;
export function errorHandler<THandles extends Class<Error>>(
  handles: THandles,
  handler: TErrorHandlerFn<THandles>
): HTTPErrorHandler<THandles>;
export function errorHandler<
  THandles extends [Class<Error>, ...Class<Error>[]]
>(
  handles: THandles,
  handler: TErrorHandlerFn<THandles>
): HTTPErrorHandler<THandles>;
export function errorHandler<T extends THandleError = Class<Error>>(
  handlerOrHandles: TErrorHandlerFn | T,
  handler?: TErrorHandlerFn<T>
): HTTPErrorHandler<T> | HTTPErrorHandler {
  if (Array.isArray(handlerOrHandles) && typeof handler === "function") {
    return {
      handles: handlerOrHandles as T,
      handler: handler,
    } satisfies HTTPErrorHandler<T>;
  }

  if (handlerOrHandles instanceof Error && typeof handler === "function") {
    return {
      handles: handlerOrHandles as T,
      handler: handler,
    } satisfies HTTPErrorHandler<T>;
  }

  if (typeof handlerOrHandles === "function" && handler == null) {
    return { handler: handlerOrHandles as TErrorHandlerFn };
  }

  throw "";
}
