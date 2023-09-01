import type { AwilixContainer } from "awilix";
import type { HTTPVersion } from "find-my-way";
import { Handler } from "./handler.js";
import type { TAnyRoute } from "./route.js";

export class HandlerFactory {
  constructor(private rootContainer: AwilixContainer) {}

  fromRoute<V extends HTTPVersion>(route: TAnyRoute): Handler<V> {
    const handler = new Handler<V>(
      route.method,
      route.url,
      this.rootContainer.createScope()
    );

    handler.schema = route.schema;

    handler.requestMiddleware = route.requestMiddleware ?? [];
    handler.errorHandler = route.errorHandler ?? [];

    handler.routeHandler = route.handler as any;

    handler.compileFileSchema();

    return handler;
  }
}
