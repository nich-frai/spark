export {
  createGuard,
  type HTTPRouteGuard as TRouteGuard,
  type IHTTPRouteGuard as TRouteGuardDef,
  type THTTPRouteGuardFn as TRouteGuardFn,
} from "./guard.js";

export { HTTPHandler as Handler } from "./handler.js";

export * as Error from "./http_error.js";

export { HTTPError as BaseError } from "./http_error.js";

export {
  requestMiddleware,
  errorHandler,
  type HTTPErrorHandler as TErrorHandler,
  type HTTPRequestMiddleware as TRequestMiddleware,
  type HTTPResponseMiddleware as TResponseMiddleware,
  type THTTPErrorGenerationMoment as TErrorGenerationMoment,
  type THTTPRequestMiddlewareFn as TRequestMiddlewareFn,
  type THTTPResponseMiddlewareFn as TResponseMiddlewareFn,
} from "./middleware.js";

export type {
  IHTTPRequestContext as TRequestContext,
  IHTTPRequestData as TRequestData,
  TRequestBody,
  TRequestCookies,
  TRequestFiles,
  TRequestHeaders,
  TRequestQueryParams,
  TRequestType,
  TRequestURLParams,
} from "./request.js";

export {
  HTTPResponse as Response,
  HTTPStatus as ResponseStatus,
} from "./response.js";

export {
  HTTPRoute as Route,
  route,
  type HTTPIncomingHeaders as TIncomingHeaders,
  type ICreateRouteOptions,
  type TAnyHTTPRoute,
} from "./route.js";

export { HTTPRouter as Router, type TCreateRouterOptions } from "./router.js";

export {
  HTTPServer as Server,
  DefaultHttpConfiguration,
  type THTTPServerOptions as TServerOptions,
} from "./server.js";
