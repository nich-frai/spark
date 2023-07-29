import { createContainer } from "#container";
import { Logger } from "#logger";
import { InjectionMode, type AwilixContainer } from "awilix";
import createRouter, { type HTTPMethod } from 'find-my-way';
import { createServer, type Server } from 'node:http';
import { createServer as createSSLServer, type Server as SSLServer } from 'node:https';
import { HTTPHandler } from "./handler.js";
import type { HTTPRoute } from "./route.js";
import { HTTPRouter } from "./router.js";
import type { SecureContextOptions, TlsOptions } from "node:tls";
import type { PartialDeep } from "type-fest";
import { deepmerge } from "#utils/deepmerge.js";

type TListenOptions = {
  host: string;
  port: number;
};

export class HTTPServer extends HTTPRouter {

  #handlers: HTTPHandler[] = [];

  #server: Server | SSLServer;

  #router = createRouter({
    allowUnsafeRegex: false,
    caseSensitive: true,
    ignoreTrailingSlash: true,
    maxParamLength: 2048,
    defaultRoute(_req, res) {
      res.statusCode = 404;
      res.write('This resource is not avaliable in this server!');
      res.end();
    }
  });

  #logger;

  #container : AwilixContainer;

  #httpConfiguration

  get raw() {
    return this.#server;
  }

  setDependencyContainer(container : AwilixContainer) {
    this.#container = container;
  }

  constructor(
    httpConfiguration?: PartialDeep<THTTPServerOptions>,
    container? : AwilixContainer
  ) {
    super();
    this.#httpConfiguration = deepmerge(DefaultHttpConfiguration, httpConfiguration ?? {}) as THTTPServerOptions;
    this.#server = this.#httpConfiguration.server.ssl != null
      ? createSSLServer(
        this.#httpConfiguration.server.ssl,
        this.#router.lookup.bind(this.#router)
      )
      : createServer(this.#router.lookup.bind(this.#router));

      this.#container = container ?? createContainer({ injectionMode : InjectionMode.CLASSIC });
      this.#logger = new Logger(HTTPServer.name);
  }

  get handlers() {
    return [...this.#handlers];
  }

  addRoute(...routes: HTTPRoute[]) {
    routes.forEach(route => {
      const handler = this.createHandlerForRoute(route);
      const method = route.method == null
        ? 'GET' as HTTPMethod
        : Array.isArray(route.method)
          ? route.method.map(r => r.toLocaleUpperCase()) as HTTPMethod[]
          : route.method.toLocaleUpperCase() as HTTPMethod;
      const url = route.url == null ? '/' : ['/', '*'].includes(route.url.charAt(0)) ? route.url : '/' + route.url;
      this.#logger.dev(` • ✅ [${String(method).padEnd(6, " ")}] ${url}`);
      this.#router.on(method, url, handler);
    });
   
    this.routes.push(...routes);
  }

  async listen(options?: TListenOptions) {

    const listOpts: TListenOptions = {
      host: options?.host ?? this.#httpConfiguration.server.host,
      port: options?.port ?? this.#httpConfiguration.server.port,
    };

    this.#server.listen(listOpts);

    return new Promise<boolean>((res, rej) => {
      this.#server.on('listening', () => {
        res(true);
      });

      this.#server.on('error', (e) => {
        console.error('server error?', e)
      });
    });

  }

  private createHandlerForRoute(route: HTTPRoute) {
    let handler = HTTPHandler.fromRoute(route, this.#container.createScope(), );
    this.#handlers.push(handler);
    return handler.handle.bind(handler);
  }

  async destroy() {
    this.#router.reset();
    if(this.#server.listening) {
      this.#server.close();
    }
    this.#server.removeAllListeners();
    this.routes = [];
    this.#handlers = [];
  }
}


export interface THTTPServerOptions {
  server: {
    host: string;
    port: number;
    ssl?: TlsOptions & SecureContextOptions;
  };
  route: {
    body: {
      maxBodySize: number;
    };
    files: {
      maxFileSize: number;
      maxTotalSize: number;
      acceptMimes: string | string[];
      minimunFileSize: number;
      maxFiles : number;
    };
    headers: {
      contentType: string | string[];
    };
  }
}

export const DefaultHttpConfiguration: THTTPServerOptions = {
  server: {
    host: '127.0.0.1',
    port: 4001
  },
  route: {
    body: {
      maxBodySize: 1024 * 1024 * 50,
    },
    headers: {
      contentType : [
        'application/json',
        'text/plain',
        'application/x-www-form-urlencoded',
        'multipart/form-data'
      ]
    },
    files: {
      acceptMimes: '*/*',
      maxFileSize: 5 * 1024 * 1024,
      maxTotalSize: 1024 * 1024 * 50,
      minimunFileSize: 128,
      maxFiles : 10,
    },
  }
}