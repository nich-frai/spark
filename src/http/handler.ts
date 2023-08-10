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
    const request =  this.requestFactory.fromHTTP(req);

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

  private async enrichRequestObject(
    req: Req<Version>,
    container: AwilixContainer
  ) {
    let enrichedRequest = req as TEnrichedRequest<Version>;

    // body parser (not used when also parsing files)
    if (this.bodySchema != null && this.fileSchema == null) {
      this._addBodyGetter(enrichedRequest, this.bodySchema);
    }

    // queryString parser
    if (this.querySchema != null) {
      this._addQueryParamsGetter(enrichedRequest, this.querySchema);
    }

    // cookie parser
    if (this.cookieSchema != null) {
      this._addCookieGetter(enrichedRequest, this.cookieSchema);
    }

    // header parser
    if (this.headerSchema != null) {
      this._addHeaderGetter(enrichedRequest, this.headerSchema);
    }

    // file parser
    if (this.fileSchema != null) {
      this._addFileAndBodyGetter(
        enrichedRequest,
        this.fileSchema,
        this.bodySchema
      );
    }

    // add function to add dependencies to container
    enrichedRequest.registerDependency = (
      nameOrRecord: string | Record<string, Resolver<unknown>>,
      provider?: Resolver<unknown>
    ) => {
      if (typeof nameOrRecord === "object" && provider == null) {
        container.register(nameOrRecord);
      }
      if (typeof nameOrRecord === "string" && provider != null) {
        container.register(nameOrRecord, provider);
      }
    };

    return req as Req<Version> & { [name: string]: unknown };
  }

  compile() {

  }

  private applyRequestMiddleware(
    request: TEnrichedRequest<Version>,
    container: AwilixContainer
  ) {}

  private _addBodyGetter(
    req: Req<Version> & { [name: string]: any },
    schema: TBodyRestriction
  ) {
    // create compiler if it does not exist
    this.#logger.debug(
      "Request has a body parser, get/create compiled checker!",
      { keys: Object.keys(schema) }
    );
    if (this.#compiledCheckers["body"] == null) {
      this.#compiledCheckers["body"] = TypeCompiler.Compile(
        Type.Object(schema)
      );
      this.#logger.debug("Compiled type checkers for body schema!", {
        keys: Object.keys(schema),
      });
    }

    // check content-type
    const contentType = req.headers["content-type"];
    if (contentType == null || !Object.keys(BodyParser).includes(contentType)) {
      throw new BadRequest(
        `This API endpoint expects body content and a supported content-type header to work properly! Please provide one of the supported content-types: ${Object.keys(
          BodyParser
        ).join(", ")}`
      );
    }

    req.body = async () => {
      this.#logger.debug(
        "Body requested for the first time! checking if it is a valid body!"
      );
      const unverifiedBody = await BodyParser[
        contentType as keyof typeof BodyParser
      ](req);
      this.#logger.debug("The parsed body is as follows: ", unverifiedBody);
      const matches = this.#compiledCheckers["body"].Check(unverifiedBody);
      // TODO: verify keys inside objects

      if (!matches) {
        let checkErrors = Array.from(
          this.#compiledCheckers["body"].Errors(unverifiedBody)
        );
        throw checkErrors;
      }

      let verifiedBody: any = {};
      for (let key of Object.keys(schema)) {
        verifiedBody[key] = (unverifiedBody as any)[key];
      }
      this.#logger.debug(
        "The parsed body matches the schema! Replacing checker function with a noop, next time it shall only return the parsed body!",
        verifiedBody
      );
      req.body = async () => verifiedBody;

      return verifiedBody;
    };
  }

  private _addQueryParamsGetter(
    req: Req<Version> & { [name: string]: any },
    schema: TQueryStringRestriction
  ) {
    const schemaKeys = Object.keys(schema);
    // create compiler if it does not exist
    this.#logger.debug(
      "Request has a query string parser, get/create compiled checker!",
      { keys: schemaKeys }
    );

    if (this.#compiledCheckers["query"] == null) {
      const checkQuerySchema: Record<string, TSchema> = {};
      for (let key in this.querySchema) {
        let check = this.querySchema[key];
        // Replace "boolean" values with a string property
        if (typeof check === "boolean") {
          checkQuerySchema[key] = Type.String();
        } else {
          checkQuerySchema[key] = check;
        }
      }
      this.#compiledCheckers["query"] = TypeCompiler.Compile(
        Type.Object(checkQuerySchema)
      );
      this.#logger.debug("Compiled type checkers for query string schema!", {
        keys: schemaKeys,
      });
    }

    req.query = async () => {
      const searchParams = new URLSearchParams(req.url);
    };
  }

  private _addCookieGetter(
    req: Req<Version> & { [name: string]: any },
    schema: TCookieRestriction
  ) {}

  private _addHeaderGetter(
    req: Req<Version> & { [name: string]: any },
    schema: THeaderRestriction
  ) {}

  private _addFileAndBodyGetter(
    req: Req<Version> & { [name: string]: any },
    fileSchema: TFileRestriction,
    bodySchema?: TBodyRestriction
  ) {}
}
