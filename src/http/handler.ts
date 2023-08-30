import { PinoLogger, type TLogger } from "#logger";
import { type TSchema } from "@sinclair/typebox";
import { TypeCheck } from "@sinclair/typebox/compiler";
import { asValue, type AwilixContainer } from "awilix";
import type { HTTPMethod, HTTPVersion, Req, Res } from "find-my-way";
import {
  HTTPError,
  InternalServerError,
  NotImplemented,
  type TErrorHandler,
} from "./http_error.js";
import type {
  TAnyRequestMiddleware,
  TAnyResponseMiddleware,
} from "./middleware.js";
import { RequestFactory } from "./request_factory.js";
import { HTTPResponse, type TResponse } from "./response.js";
import type {
  TBodySchema,
  TCookieSchema,
  TFileSchema,
  THeaderSchema,
  TQueryStringSchema,
} from "./schema.js";
import type { TRequest } from "./request.js";
type TAnyHTTPMethod = HTTPMethod | Lowercase<HTTPMethod> | (string & {});

type TFnServices = string[];
type TEnrichedRequest<V extends HTTPVersion> = Req<V> & {
  [name: string]: any;
};

export class Handler<
  Version extends HTTPVersion.V1 | HTTPVersion.V2 = HTTPVersion.V1
> {
  #logger: TLogger;

  constructor(method: TAnyHTTPMethod, url: string, container: AwilixContainer) {
    this.handle = this.handle.bind(this);
    this.url = url;
    this.method = method.toLocaleUpperCase();

    const handlerLogName = `Handler::${this.method}::${url}`;
    if (container.hasRegistration("logger")) {
      this.#logger = container.resolve("logger");
    } else {
      this.#logger = new PinoLogger({ name: handlerLogName });
    }

    this.container = container;
  }

  method: TAnyHTTPMethod = "GET";
  url: string = "/";

  bodySchema: TBodySchema | undefined = undefined;
  fileSchema: TFileSchema | undefined = undefined;
  querySchema: TQueryStringSchema | undefined = undefined;
  cookieSchema: TCookieSchema | undefined = undefined;
  headerSchema: THeaderSchema | undefined = undefined;

  routeHandler?: (
    req: TRequest<any, any, any, any, any>,
    ...services: unknown[]
  ) => unknown | void;
  #routeHandlerServices?: string[];
  get routeHandlerServices() {
    if (this.#routeHandlerServices == null) {
      this.#routeHandlerServices =
        this.routeHandler != null
          ? extractFunctionParameters(this.routeHandler)
          : [];
    }
    return this.#routeHandlerServices;
  }

  #compiledCheckers: Record<string, TypeCheck<TSchema>> = {};

  #requestMiddlewareServices?: TFnServices[];
  private get requestMiddewareServices() {
    if (this.#requestMiddlewareServices == null) {
      this.#requestMiddlewareServices = this.requestMiddleware.map((m) => {
        return extractFunctionParameters(m.handle).slice(1);
      });
    }
    return this.#requestMiddlewareServices!;
  }
  requestMiddleware: TAnyRequestMiddleware[] = [];

  #responseMiddlewareServices?: TFnServices[];
  private get responseMiddlewareServices() {
    if (this.#responseMiddlewareServices == null) {
      this.#responseMiddlewareServices = this.responseMiddleware.map((m) => {
        return extractFunctionParameters(m.handle).slice(1);
      });
    }
    return this.#responseMiddlewareServices;
  }
  responseMiddleware: TAnyResponseMiddleware[] = [];

  #errorHandlerServices?: TFnServices[];
  private get errorHandlerServices() {
    if (this.#errorHandlerServices == null) {
      this.#errorHandlerServices = this.errorHandler.map((m) => {
        return extractFunctionParameters(m.handle).slice(1);
      });
    }
    return this.#errorHandlerServices;
  }
  errorHandler: TErrorHandler[] = [];

  container: AwilixContainer;

  #requestFactory?: RequestFactory<Version>;
  private get requestFactory() {
    if (this.#requestFactory == null) {
      this.#requestFactory = new RequestFactory<Version>(this.container, {
        body: this.bodySchema,
        files: this.fileSchema,
        cookies: this.cookieSchema,
        header: this.headerSchema,
        query: this.querySchema,
      });
    }
    return this.#requestFactory!;
  }

  async handle(req: Req<Version>, res: Res<Version>, ctx: unknown) {
    const container = this.container.createScope();

    container.register('serverResponse', asValue(res))

    this.#logger.debug("Matched handler! Will now process incoming request!", {
      url: req.url,
      matchedPath: this.url,
      method: req.method,
    });

    // enrich request object
    const request = (await this.requestFactory.fromHTTP(container, req)) as any;
    if (request instanceof Error) {
      this.#logger.debug(
        "Failed to process incoming request! An error ocurred while parsing",
        request
      );
      this.sendResponse(res, request);
      return;
    }

    // apply request middleware
    for (let i = 0; i < this.requestMiddleware.length; i++) {
      const middleware = this.requestMiddleware[i];
      if (middleware.inject != null) container.register(middleware.inject);

      const serviceNames = this.requestMiddewareServices[i];
      const services: any[] = Array.from({ length: serviceNames.length });
      for (let a = 0; a < serviceNames.length; a++) {
        const name = serviceNames[a];
        if (!container.hasRegistration(name)) {
          this.#logger.error(
            `Failed to resolve service with name "${name}" on route "[${this.method}]${this.url}" of request middleware`
          );
          this.sendResponse(
            res,
            new InternalServerError(
              "Failed to resolve required service name for this route!"
            )
          );
          return;
        }
        try {
          const service = container.resolve(name);
          services[a] = service;
        } catch (err) {
          this.#logger.error(
            `Failed to resolve dependency tree of "${name}" on route "[${this.method}]${this.url}" of request middleware`,
            err
          );
          this.sendResponse(
            res,
            new InternalServerError(
              "Failed to resolve required service name for this route!"
            )
          );
          return;
        }
      }

      let middlewareReturn = middleware.handle(request, ...services);
      if (middlewareReturn instanceof Promise) {
        middlewareReturn = await middlewareReturn.catch((err) => {
          this.#logger.warn(
            "Request Middleware throwed an uncatched error while processing the request",
            err
          );
          throw err;
        });
      }
      if (
        middlewareReturn instanceof Error ||
        middlewareReturn instanceof HTTPResponse
      ) {
        this.sendResponse(res, middlewareReturn);
        return;
      }
    }

    if (this.routeHandler == null) {
      this.sendResponse(
        res,
        new NotImplemented("Route handler not implemented!")
      );
      return;
    }

    // call route handler
    const handlerServiceNames = this.routeHandlerServices;
    const handlerServices: any[] = Array.from({
      length: handlerServiceNames.length,
    });
    for (let a = 0; a < handlerServiceNames.length; a++) {
      const name = handlerServiceNames[a];
      if (!container.hasRegistration(name)) {
        this.#logger.error(
          `Failed to resolve service with name "${name}" on route "[${this.method}]${this.url}"`
        );
        this.sendResponse(
          res,
          new InternalServerError(
            "Failed to resolve required service name for this route!"
          )
        );
        return;
      }
      try {
        const service = container.resolve(name);
        handlerServices[a] = service;
      } catch (err) {
        this.#logger.error(
          `Failed to resolve dependency tree of "${name}" on route "[${this.method}]${this.url}"`,
          err
        );
        this.sendResponse(
          res,
          new InternalServerError(
            "Failed to resolve required service name for this route!"
          )
        );
        return;
      }
    }

    let handlerResponse = this.routeHandler(request, ...handlerServices);
    // handle promise return
    if (handlerResponse instanceof Promise) {
      handlerResponse = await handlerResponse.catch((err) => {
        if (err instanceof Error || err instanceof HTTPResponse) {
          this.sendResponse(res, err);
          throw err;
        } else {
          throw err;
        }
      });
    }

    //
  }

  private sendResponse(res: Res<Version>, message: Error | HTTPResponse) {

    if(res.writableEnded) {
      this.#logger.debug(`SendResponse is a NOOP because ServerResponse has "writableEnded" as true!`);
      return;
    }

    if (message instanceof Error) {

      // If headers were not sent we can set the status code 
      if(!res.headersSent) {
        if (message instanceof HTTPError) {
          res.statusCode = message.status;
        } else {
          res.statusCode = 500;
        }
      }

      res.end(message.message);
      return;
    }

    
  }

  private applyRequestMiddleware(
    request: TEnrichedRequest<Version>,
    container: AwilixContainer
  ) {}
}

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;

function extractFunctionParameters(fn: Function): string[] {
  const fnStr = fn.toString().replace(STRIP_COMMENTS, "");
  const result = fnStr
    .slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")"))
    .match(ARGUMENT_NAMES);
  if (result === null) return [];
  return result;
}
