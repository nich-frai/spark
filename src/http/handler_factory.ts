import type { AwilixContainer } from "awilix";
import type { Route, TAnyRoute } from "./route.js";
import { Handler } from "./handler.js";
import type { HTTPVersion } from "find-my-way";

export class HandlerFactory {
  constructor(private rootContainer: AwilixContainer) {}

  fromRoute<V extends HTTPVersion>(route: TAnyRoute): Handler<V> {

    const handler = new Handler<V>(
      route.method,
      route.url,
      this.rootContainer.createScope()
    );

    handler.bodySchema = route.body
    handler.cookieSchema = route.cookie
    handler.fileSchema = route.file
    handler.headerSchema = route.header
    handler.querySchema = route.queryString
    
    handler.requestMiddleware = route.requestMiddleware ?? []
    handler.responseMiddleware = route.responseMiddleware  ?? []
    handler.errorHandler = route.errorHandler ?? [];

    handler.routeHandler = route.handler as any;  

    return handler;
  }
}
