import type { Resolver } from "awilix";
import type { TRequestMiddleware } from "./middleware.js";
import { Route, type TRouteCreationOptionsShort } from "./route.js";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TQueryStringRestriction,
  TServicesRestriction,
} from "./schema.js";
import type { HTTPMethod } from "find-my-way";
import { join } from "node:path";

type TAnyRoute = Route<any, any, any, any, any, any>;
type TAnyMiddleware = TRequestMiddleware<any, any, any, any, any, any>;

export class Router {
  protected _resolvers: Record<string, Resolver<unknown>> = {};
  protected _routes: TAnyRoute[] = [];
  protected _childRouters: [string /* path */, Router][] = [];

  protected _middleware: TAnyMiddleware[] = [];

  addRoute(...routes: TAnyRoute[]) {
    this._routes.push(...routes);
    return this;
  }

  use(...middleware: TAnyMiddleware[]) {
    this._middleware.push(...middleware);
  }

  mount(router : Router) : void;
  mount(path: string, router: Router) : void;
  mount(pathOrRouter : string | Router, router? : Router) {
    if(pathOrRouter instanceof Router) this._childRouters.push(["", pathOrRouter]);
    else if(router instanceof Router) this._childRouters.push([pathOrRouter, router!]);
    else throw 'incorrect arguments for Router.mount function, expecting: (router: Router) OR (path : string, router: Router)!';
  }

  register(dictionary: Record<string, Resolver<unknown>>): void;
  register(name: string, provider: Resolver<unknown>): void;
  register(
    nameOrDictionary: string | Record<string, Resolver<unknown>>,
    provider?: Resolver<unknown>
  ) {
    if (typeof nameOrDictionary === "string" && provider != null) {
      this._resolvers[nameOrDictionary] = provider!;
      return;
    }

    if (typeof nameOrDictionary === "object") {
      for (let dependencyName in nameOrDictionary) {
        this._resolvers[dependencyName] = nameOrDictionary[dependencyName];
      }
      return;
    }

    throw `Could not register the resolvers with the provided arguments!
[ ERROR ] : Incorrect format! 
Either:
1. Provide a dictionary using the name of the registration as the key:
  @example: router.register({ name1 : asClass(...), name2 : asFunction(....) }); 
2. Provide two arguments, the first being the string and the second one the resolver:
  @example: router.register("name", asClass(...));`;
  }

  GET<
    TBody extends TBodyRestriction = {},
    TQueryString extends TQueryStringRestriction = {},
    THeader extends THeaderRestriction = {},
    TCookie extends TCookieRestriction = {},
    TFile extends TFileRestriction = {},
    TServices extends TServicesRestriction = [unknown, ...unknown[]]
  >(
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const r = new Route<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >({
      ...options,
      method: "GET",
      url,
    });

    this.addRoute(r);
    return r;
  }

  POST<
    TBody extends TBodyRestriction,
    TQueryString extends TQueryStringRestriction,
    THeader extends THeaderRestriction,
    TCookie extends TCookieRestriction,
    TFile extends TFileRestriction,
    TServices extends TServicesRestriction
  >(
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const r = new Route<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >({
      ...options,
      method: "POST",
      url,
    });

    this.addRoute(r);
    return r;
  }

  PUT<
    TBody extends TBodyRestriction,
    TQueryString extends TQueryStringRestriction,
    THeader extends THeaderRestriction,
    TCookie extends TCookieRestriction,
    TFile extends TFileRestriction,
    TServices extends TServicesRestriction
  >(
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const r = new Route<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >({
      ...options,
      method: "PUT",
      url,
    });

    this.addRoute(r);
    return r;
  }

  PATCH<
    TBody extends TBodyRestriction,
    TQueryString extends TQueryStringRestriction,
    THeader extends THeaderRestriction,
    TCookie extends TCookieRestriction,
    TFile extends TFileRestriction,
    TServices extends TServicesRestriction
  >(
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const r = new Route<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >({
      ...options,
      method: "PUT",
      url,
    });

    this.addRoute(r);
    return r;
  }

  DELETE<
    TBody extends TBodyRestriction,
    TQueryString extends TQueryStringRestriction,
    THeader extends THeaderRestriction,
    TCookie extends TCookieRestriction,
    TFile extends TFileRestriction,
    TServices extends TServicesRestriction
  >(
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const r = new Route<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >({
      ...options,
      method: "DELETE",
      url,
    });

    this.addRoute(r);
    return r;
  }

  route<
    TBody extends TBodyRestriction,
    TQueryString extends TQueryStringRestriction,
    THeader extends THeaderRestriction,
    TCookie extends TCookieRestriction,
    TFile extends TFileRestriction,
    TServices extends TServicesRestriction
  >(
    method: HTTPMethod | Lowercase<HTTPMethod> | (string & {}),
    url: string,
    options: TRouteCreationOptionsShort<
      TBody,
      TQueryString,
      THeader,
      TCookie,
      TFile,
      TServices
    >
  ) {
    const route = new Route({
      url,
      method,
      ...options,
    });

    this.addRoute(route);
    return route;
  }

  getChildRouters(): [string, Router][] {
    return this._childRouters;
  }

  getRoutes() {
    return this._routes;
  }

  getMiddlewares() {
    return this._middleware;
  }

  getDependencyResolvers() {
    return this._resolvers;
  }

  assembleRoutes() {
    const routes : TAnyRoute[] = this._routes;

    // update url path of child routers
    for(let [path, router] of this._childRouters) {
      const childRoutes = router.assembleRoutes();
      for(let route of childRoutes) {
        route._url = join(path, route._url);
        routes.push(route);
      }
    }

    for(let route of routes) {
      
      // add this router middlewares
      if(route._middlewares == null) route._middlewares = [];
      route._middlewares = [
        ...this._middleware,
        ...route._middlewares
      ];

      // add this router dependency resolvers
      route._inject = {
        ...this._resolvers,
        ...route._inject
      }
    }

    return routes;
  }
}
