import { Logger } from "#logger";
import type { HTTPErrorInterceptor, HTTPRequestInterceptor, HTTPResponseInterceptor } from "./interceptors.js";
import type { TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestURLParams } from "./request.js";
import type { HTTPRoute } from "./route.js";
import type { HTTPRouteGuard } from "./guard.js";

export type TAnyRouter = Router<any, any, any, any, any, any[]>;

export class Router<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[]
  > {

  register?: Record<string, unknown>;

  onRequest?: (HTTPRequestInterceptor<Body, Headers, Cookies, URLParams, QueryParams>)[] = [];
  onResponse?: HTTPResponseInterceptor[] = [];
  onError? : HTTPErrorInterceptor[] = [];
  
  guard?: HTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services>[] = [];

  // require schema
  headers?: Headers;
  cookies?: Cookies;
  body?: Body;
  queryParams?: QueryParams;
  urlParams?: URLParams;

  #logger: Logger = new Logger(Router.name);

  applyToRoute(...routes: HTTPRoute<Body, Headers, Cookies, URLParams, QueryParams>[]) {
    routes.forEach(route => {
      // prepend interceptors and guards
      route.onRequest = [...this.onRequest ?? [], ...route.onRequest ?? []];
      route.onResponse = [...this.onResponse ?? [], ...route.onResponse ?? []];
      route.onResponse = [...this.onResponse ?? [], ...route.onResponse ?? []];
      route.guards = [...this.guard ?? [], ...route.guards ?? []] as any[];

      // merge schemas
      if (route.body != null) {
        if (this.body != null) {
          route.body = route.body!
        } else {
          route.body = {
            ...this.body,
            ...route.body!
          }
        }
      } else {
        route.body = this.body;
      }

      if(route.cookies != null) {
        route.cookies = {
          ...this.cookies!,
          ...route.cookies
        };
      } else {
        route.cookies = this.cookies;
      }

      if(route.headers != null) {
        route.headers = {
          ...this.headers!,
          ...route.headers
        };
      } else {
        route.headers = this.headers;
      }

      if(route.urlParams != null) {
        route.urlParams = {
          ...this.urlParams!,
          ...route.urlParams
        };
      } else {
        route.urlParams = this.urlParams;
      }

      if(route.queryParams != null) {
        route.queryParams = {
          ...this.queryParams!,
          ...route.queryParams
        };
      } else {
        route.queryParams = this.queryParams;
      }

      if(route.register != null) {
        route.register = {
          ...this.register,
          ...route.register
        };
      } else {
        route.register = this.register;
      }

    });
  }

}

export function createRouter<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  >(options: ICreateRouter<Body, Headers, Cookies, URLParams, QueryParams, Services>) {
  const router = new Router<Body, Headers, Cookies, URLParams, QueryParams, Services>();

  router.body = options.body;
  router.headers = options.headers;
  router.cookies = options.cookies;
  router.urlParams = options.urlParams;
  router.queryParams = options.queryParams;

  router.register = options.register;

  router.guard = options.guard;
  router.onRequest = options.onRequest;
  router.onResponse = options.onResponse;
  router.onError = options.onError;

  return router;
}

export interface ICreateRouter<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > {
  register?: Record<string, unknown>;

  onRequest?: HTTPRequestInterceptor<Body, Headers, Cookies, URLParams, QueryParams>[];
  onResponse?: HTTPResponseInterceptor[];
  onError? : HTTPErrorInterceptor[];

  guard?: HTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services>[];

  // require schema
  headers?: Headers;
  cookies?: Cookies;
  body?: Body;
  queryParams?: QueryParams;
  urlParams?: URLParams;
}

