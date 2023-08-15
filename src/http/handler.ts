import { PinoLogger, type TLogger } from "#logger";
import { Type, type TSchema } from "@sinclair/typebox";
import { TypeCheck, TypeCompiler } from "@sinclair/typebox/compiler";
import type { AwilixContainer, Resolver } from "awilix";
import type { HTTPMethod, HTTPVersion, Req, Res } from "find-my-way";
import { URLSearchParams } from "node:url";
import { BodyParser } from "./body_parser/index.js";
import { BadRequest, type TErrorHandler } from "./http_error.js";
import type {
  TAnyRequestMiddleware,
  TAnyResponseMiddleware,
} from "./middleware.js";
import { HTTPResponse } from "./response.js";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TQueryStringRestriction,
} from "./schema.js";
import { RequestFactory } from "./request_factory.js";
type TAnyHTTPMethod = HTTPMethod | Lowercase<HTTPMethod> | (string & {});

type TFnServices = string[]
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

    const handlerLogName = `HTTP Handler::${this.method}::${url}`;
    if (container.hasRegistration("logger")) {
      this.#logger = container.resolve("logger");
    } else {
      this.#logger = new PinoLogger({ name: handlerLogName });
    }

    this.container = container;
  }

  method: TAnyHTTPMethod = "GET";
  url: string = "/";

  bodySchema: TBodyRestriction | undefined = undefined;
  fileSchema: TFileRestriction | undefined = undefined;
  querySchema: TQueryStringRestriction | undefined = undefined;
  cookieSchema: TCookieRestriction | undefined = undefined;
  headerSchema: THeaderRestriction | undefined = undefined;

  #compiledCheckers: Record<string, TypeCheck<TSchema>> = {};

  #requestMiddlewareServices?: TFnServices[];
  private get requestMiddewareServices() {
    if(this.#requestMiddlewareServices == null) {

    }
    return this.#requestMiddlewareServices
  }
  requestMiddleware: TAnyRequestMiddleware[] = [];

  #responseMiddlewareServices?: TFnServices[];
  private get responseMiddlewareServices() {
    if(this.#responseMiddlewareServices == null) {

    }
    return this.#responseMiddlewareServices
  }
  responseMiddleware: TAnyResponseMiddleware[] = [];

  #errorHandlerServices?: TFnServices[];
  private get errorHandlerServices() {
    if(this.#responseMiddlewareServices == null) {

    }
    return this.#errorHandlerServices
  }
  errorHandler: TErrorHandler[] = [];

  container: AwilixContainer;

  #requestFactory?: RequestFactory<Version>;
  private get requestFactory() {
    if(this.#requestFactory == null) {
      this.#requestFactory = new RequestFactory<Version>(this.container)
      
      this.#requestFactory.body = this.bodySchema
      this.#requestFactory.cookies = this.cookieSchema
      this.#requestFactory.files = this.fileSchema
      this.#requestFactory.headers = this.headerSchema
      this.#requestFactory.query = this.querySchema

    }
    return this.#requestFactory!;
  }

  
  async handle(req: Req<Version>, res: Res<Version>, ctx: unknown) {
    const container = this.container.createScope();

    this.#logger.debug("Matched handler! Will now process incoming request!", {
      url: req.url,
      matchedPath: this.url,
      method: req.method,
    });

    // enrich request object with accessors
    const request = await this.requestFactory.fromHTTP(req);

    // apply request middleware
    for (let middleware of this.requestMiddleware) {
      //TODO: find out which services does the middleware requires
      let middlewareReturn = middleware.handle(request as any, res);
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
        middleware instanceof HTTPResponse
      ) {
      }
    }
  }

  compile() {

  }

  private applyRequestMiddleware(
    request: TEnrichedRequest<Version>,
    container: AwilixContainer
  ) {}

 
}
