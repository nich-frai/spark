import type { Resolver } from "awilix";
import type { HTTPMethod } from "find-my-way";
import { join } from "node:path";
import type { TErrorHandler } from "./http_error.js";
import type {
  TAnyMiddleware,
} from "./middleware.js";
import {
  Route,
  type TAnyRoute,
  type TRouteCreationOptionsShort,
} from "./route.js";
import type {
  TRouteSchema,
  TServicesSchema
} from "./schema.js";

export class Router {
  protected _resolvers: Record<string, Resolver<unknown>> = {};
  protected _routes: TAnyRoute[] = [];
  protected _childRouters: [string /* path */, Router][] = [];

  protected _requestMiddleware: TAnyMiddleware[] = [];
  protected _errorHandlers: TErrorHandler[] = [];

  addRoute(...routes: TAnyRoute[]) {
    this._routes.push(...routes);
    return this;
  }

  useOnRequest(...middleware: TAnyMiddleware[]) {
    this._requestMiddleware.push(...middleware);
  }

  useOnError(...handlers: TErrorHandler[]) {
    this._errorHandlers.push(...handlers);
  }

  mount(router: Router): void;
  mount(path: string, router: Router): void;
  mount(pathOrRouter: string | Router, router?: Router) {
    if (pathOrRouter instanceof Router)
      this._childRouters.push(["", pathOrRouter]);
    else if (router instanceof Router)
      this._childRouters.push([pathOrRouter, router!]);
    else
      throw "incorrect arguments for Router.mount function, expecting: (router: Router) OR (path : string, router: Router)!";
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

  route<TSchema extends TRouteSchema, TServices extends TServicesSchema>(
    method: HTTPMethod | Lowercase<HTTPMethod> | (string & {}),
    url: string,
    options: TRouteCreationOptionsShort<TSchema, TServices>
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
    return this._requestMiddleware;
  }

  getDependencyResolvers() {
    return this._resolvers;
  }

  assembleRoutes() {
    const routes: TAnyRoute[] = this._routes;

    // update url path of child routers
    for (let [path, router] of this._childRouters) {
      const childRoutes = router.assembleRoutes();
      for (let route of childRoutes) {
        route.url = join(path, route.url);
        routes.push(route);
      }
    }

    for (let route of routes) {
      // add this router request middlewares
      if (route.requestMiddleware == null) route.requestMiddleware = [];
      route.requestMiddleware = [
        ...this._requestMiddleware,
        ...route.requestMiddleware,
      ];

      // add this router error handlers
      if (route.errorHandler == null) route.errorHandler = [];
      route.errorHandler = [...this._errorHandlers, ...route.errorHandler];

      // add this router dependency resolvers
      route.inject = {
        ...this._resolvers,
        ...route.inject,
      };
    }

    return routes;
  }
}
