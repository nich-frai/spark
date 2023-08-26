import { InjectionMode, createContainer, type AwilixContainer } from "awilix";
import {
  default as createRouter,
  type HTTPMethod,
  type HTTPVersion,
  type Instance as LookupRouter,
  type Req,
  type Res,
  type Config as RouterConfig,
} from "find-my-way";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createServer,
  type Server as HTTP_Server,
  type ServerOptions,
} from "node:http";
import {
  createServer as createSSLServer,
  type Server as HTTPS_Server,
} from "node:https";
import type { ListenOptions } from "node:net";
import type { SecureContextOptions, TlsOptions } from "node:tls";
import { PinoLogger, type TLogger } from "../logger/logger.js";
import { Handler } from "./handler.js";
import { HandlerFactory } from "./handler_factory.js";
import { Router } from "./router.js";

export const RootContainer: AwilixContainer = createContainer({
  injectionMode: InjectionMode.CLASSIC,
});

export class Server<
  Version extends HTTPVersion.V1 | HTTPVersion.V2 = HTTPVersion.V1
> extends Router {
  private _isBoundToProccessTermination = false;
  private _isCompiled = false;

  private _router: LookupRouter<Version>;
  private _container = RootContainer.createScope();
  private _server: HTTPS_Server | HTTP_Server | undefined;
  private _logger: TLogger;

  private _handlers: Handler<Version>[] = [];

  constructor(private options?: TServerCreationOptions<Version>) {
    super();
    this.handle = this.handle.bind(this);
    this._logger = options?.logger ?? new PinoLogger({ name: "HTTP Server" });

    this._router = createRouter<Version>(
      Object.assign(
        {
          allowUnsafeRegex: false,
          caseSensitive: true,
          ignoreTrailingSlash: true,
          ignoreDuplicateSlashes: true,
        },
        options?.router ?? {}
      )
    );
  }

  get logger() {
    return this._logger;
  }

  handle(request: IncomingMessage, response: ServerResponse) {
    this._logger.debug("New incoming request for the server!", {
      url : request.url,
      method : request.method,
    });
    return this._router.lookup(
      request as Req<Version>,
      response as Res<Version>
    );
  }

  // add the routes to the FindMyWay router
  private _compile() {
    const factory = new HandlerFactory(this._container);
    this._container.register(this._resolvers);

    const routes = this.assembleRoutes();
    this._logger.debug(
      "Compiling server routes!",
      `Discovered ${routes.length} route(s)`,
      ...routes.map((r) => `Route: ${r.method.toLocaleUpperCase()} @ ${r.url}`)
    );

    for (let route of routes) {
      const handler = factory.fromRoute<Version>(
        route
      );
      this._handlers.push(handler);
      this._router.on(
        handler.method.toLocaleUpperCase() as HTTPMethod,
        handler.url,
        handler.handle
      );
    }

    this._isCompiled = true;
  }

  listen(host: string, port: number): Promise<ListenOptions>;
  listen(port: number): Promise<ListenOptions>;
  listen(options: ListenOptions): Promise<ListenOptions>;
  async listen(
    arg1: ListenOptions | string | number,
    port?: number
  ): Promise<ListenOptions> {
    // Previous server listening ?
    if (this._server != null && this._server.listening) {
      await new Promise((res, rej) =>
        this._server!.close((err) => (err != null ? rej(err) : res))
      ).catch((err) => {
        this._logger.error(
          "Failed to start listening! there was a previous running server that errored while being closed!",
          err
        );
        throw err;
      });
    }

    this._server =
      this.options?.ssl != null
        ? createSSLServer({
            ...this.options!,
            ...this.options!.ssl,
          })
        : createServer({ 
          
          highWaterMark : 1024 * 1024, // 1mb
          
          ...this.options,
        });

    this._server!.addListener("request", this.handle);

    const options: ListenOptions = {};
    // deal with (port : number) => signature
    if (typeof arg1 === "number") {
      options.host = "127.0.0.1";
      options.port = arg1;
    }

    // deal with (host : string, port : number) => signature
    if (typeof arg1 === "string" && typeof port === "number") {
      options.host = arg1;
      options.port = port;
    }

    // deal with (options : ListenOptions) => signature
    if (typeof arg1 == "object") {
      Object.assign(options, arg1);
    }

    this._bindToProccessEnd();

    if (!this._isCompiled) {
      this._compile();
    }

    return new Promise<ListenOptions>((res, rej) => {
      this._server!.listen(options, () => {
        res(options);
      });
      this._server!.once("error", (err) => {
        rej(err);
      });
    });
  }

  private _bindToProccessEnd() {
    if (!this._isBoundToProccessTermination) {
      ["exit", "SIGINT", "SIGUSR1", "SIGUSR2", "SIGTERM"].forEach((type) =>
        process.once(type, () => this._server && this._server.close())
      );
      this._isBoundToProccessTermination = true;
    }
  }
}

export interface TServerCreationOptions<
  V extends HTTPVersion.V1 | HTTPVersion.V2
> extends ServerOptions {
  ssl?: SecureContextOptions & TlsOptions;
  logger?: TLogger;
  router?: RouterConfig<V>;
}

export type TListenOptions =
  | string
  | {
      host: string;
      port: number;
    };
