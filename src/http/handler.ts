import type { AwilixContainer } from "awilix";
import { type TAnyRoute } from "./route.js";
import type { HTTPMethod, HTTPVersion, Req, Res } from "find-my-way";
import { PinoLogger, type TLogger } from "#logger";
import type { TBodyRestriction, TFileRestriction } from "./schema.js";
import {
  TypeCompiler,
  type CheckFunction,
  TypeCheck,
} from "@sinclair/typebox/compiler";
import { Type, type TSchema } from "@sinclair/typebox";
import { BodyParser } from "./bodyParser/index.js";
import { BadRequest } from "./http_error.js";
type TAnyHTTPMethod = HTTPMethod | Lowercase<HTTPMethod> | (string & {});

export class Handler<
  Version extends HTTPVersion.V1 | HTTPVersion.V2 = HTTPVersion.V1
> {
  static fromRoute<V extends HTTPVersion.V1 | HTTPVersion.V2>(
    container: AwilixContainer,
    route: TAnyRoute
  ) {
    const handler = new Handler<V>(route._method, route._url, container);
    return handler;
  }

  #logger: TLogger;

  constructor(
    method: TAnyHTTPMethod,
    url: string,
    container?: AwilixContainer
  ) {
    this.handle = this.handle.bind(this);
    this.url = url;
    this.method = method.toLocaleUpperCase();

    const handlerLogName = `HTTP Handler::${this.method}::${url}`;
    this.#logger = container?.hasRegistration("logger")
      ? container.resolve("logger").child(handlerLogName)
      : new PinoLogger({ name: handlerLogName }) ??
        new PinoLogger({ name: handlerLogName });
  }

  method: TAnyHTTPMethod = "GET";
  url: string = "/";

  bodySchema: TBodyRestriction | undefined = undefined;
  fileSchema: TFileRestriction | undefined = undefined;

  #compiledCheckers: Record<string, TypeCheck<TSchema>> = {};

  handle(req: Req<Version>, res: Res<Version>, ctx: unknown) {
    this.#logger.debug("Matched handler! Will now process incoming request!", {
      url: req.url,
      matchedPath: this.url,
      method: req.method,
    });

    // enrich request object with accessors
    const request = this.enrichRequestObject(req);
  }

  private enrichRequestObject(req: Req<Version>) {
    // body parser (dont use when also parsing files)
    if (this.bodySchema != null && this.fileSchema == null) {
      // create compiler if it does not exist
      this.#logger.debug(
        "Request has a body parser, get/create compiled checker!",
        { keys: Object.keys(this.bodySchema) }
      );
      if (this.#compiledCheckers["body"] == null) {
        this.#compiledCheckers["body"] = TypeCompiler.Compile(
          Type.Object(this.bodySchema)
        );
        this.#logger.debug("Compiled type checkes for body schema!", {
          keys: Object.keys(this.bodySchema),
        });
      }

      // check content-type
      const contentType = req.headers["content-type"];
      if (
        contentType == null ||
        !Object.keys(BodyParser).includes(contentType)
      ) {
        throw new BadRequest(
          `This API endpoint expects body content and a supported content-type header to work properly! Please provide one of the supported content-types: ${Object.keys(
            BodyParser
          ).join(", ")}`
        );
      }
      const unverrifiedBody = BodyParser[contentType as keyof typeof BodyParser](req)
    }

    return req as Req<Version>;
  }
}
