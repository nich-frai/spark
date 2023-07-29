import type { HTTPRouteGuard } from "./guard";
import type { HTTPErrorHandler, HTTPRequestMiddleware, HTTPResponseMiddleware } from "./middleware";
import type { HTTPRoute } from "./route";

export class HTTPRouter {

    childRouters : [string /* path */, HTTPRouter][] = []
    routes : HTTPRoute[] = [];
    guards : HTTPRouteGuard[] = [];
    
    onRequestMiddleware : HTTPRequestMiddleware[] = [];
    onResponseMiddleware : HTTPResponseMiddleware[] = [];
    onErrorHandlers : HTTPErrorHandler[] = [];

    constructor(options? : TCreateRouterOptions) {

    }

    add(...routes : HTTPRoute[]) {
        this.routes.push(...routes);
        return this;
    }

    onRequest(...middleware : HTTPRequestMiddleware[]) {
        this.onRequestMiddleware.push(...middleware);
        return this;
    }

    onResponse(...middleware : HTTPResponseMiddleware[]) {
        this.onResponseMiddleware.push(...middleware);
        return this;
    }

    mount(path : string, router : HTTPRouter) {
        this.childRouters.push([path, router]);
        return this;
    }

}

export interface TCreateRouterOptions {
    routes? : HTTPRoute[],

    guards? : HTTPRouteGuard[],
    requestMiddleware? : HTTPRequestMiddleware[],
    responseMiddleware? : HTTPResponseMiddleware[],

    errorHandler? : HTTPErrorHandler[],
}