import { Type, type TSchema } from "@sinclair/typebox";
import { TypeCheck, TypeCompiler } from "@sinclair/typebox/compiler";
import type { HTTPVersion, Req } from "find-my-way";
import type {
  TBodySchema,
  TCookieSchema,
  TFileSchema,
  THeaderSchema,
  TQueryStringSchema,
} from "./schema.js";
import type { AwilixContainer, Resolver } from "awilix";
import { BadRequest } from "./http_error.js";
import { cookieParser } from "./cookie.js";
import { queryStringParser } from "./query_string.js";
import { BodyParser } from "./body_parser/index.js";

export class RequestFactory<V extends HTTPVersion> {
  #bodyChecker: TypeCheck<TSchema> | undefined;
  #body?: TBodySchema;
  get body() {
    return this.#body;
  }
  set body(body: TBodySchema | undefined) {
    this.#body = body;
    if (body != null)
      this.#bodyChecker = TypeCompiler.Compile(Type.Object(body));
    else this.#bodyChecker = undefined;
  }

  #headers?: THeaderSchema;
  #headersChecker: TypeCheck<TSchema> | undefined;
  get headers() {
    return this.#headers;
  }
  set headers(header: THeaderSchema | undefined) {
    this.#headers = header;
    if (header != null) {
      const normalizedSchema: { [name: string]: TSchema } = {};
      for (let key in header) {
        const v = header[key];
        normalizedSchema[key] =
          typeof v === "boolean" ? Type.String() : (header[key] as TSchema);
      }
      this.#headersChecker = TypeCompiler.Compile(
        Type.Object(normalizedSchema)
      );
    }
  }

  #cookies?: TCookieSchema;
  #cookiesChecker?: TypeCheck<TSchema> | undefined;
  get cookies() {
    return this.#cookies;
  }
  set cookies(cookies: TCookieSchema | undefined) {
    this.#cookies = cookies;
    if (this.#cookies == null) this.#cookiesChecker = undefined;
    else {
      const normalizedSchema: { [name: string]: TSchema } = {};
      for (let key in cookies) {
        const v = cookies[key];
        normalizedSchema[key] =
          typeof v === "boolean" ? Type.String() : (cookies[key] as TSchema);
      }
      this.#cookiesChecker = TypeCompiler.Compile(
        Type.Object(normalizedSchema)
      );
    }
  }

  #query?: TQueryStringSchema;
  #queryChecker?: TypeCheck<TSchema> | undefined;
  get query() {
    return this.#query;
  }
  set query(query: TQueryStringSchema | undefined) {
    this.#query = query;
    if (this.#query == null) this.#queryChecker = undefined;
    else {
      const normalizedSchema: { [name: string]: TSchema } = {};
      for (let key in query) {
        const v = query[key];
        normalizedSchema[key] =
          typeof v === "boolean" ? Type.String() : (query[key] as TSchema);
      }
      this.#queryChecker = TypeCompiler.Compile(Type.Object(normalizedSchema));
    }
  }

  #files?: TFileSchema;
  // TODO: create file validation function
  #filesChecker?: unknown | undefined;
  get files() {
    return this.#files;
  }
  set files(files: TFileSchema | undefined) {
    this.#files = files;
  }

  #bodyParser?: BodyParser;
  get bodyParser() {
    if (this.#bodyParser == null && (this.files != null || this.body != null)) {
      this.#bodyParser = new BodyParser(this.container, {
        fileSchema: this.files,
        bodySchema: this.body,
        maxBodySize: this.options.maxBodySize,
      });
    }

    return this.#bodyParser;
  }

  private options: TRequestFactoryOptions;
  constructor(
    private container: AwilixContainer,
    options: TRequestFactoryOptions
  ) {
    this.options = options;
    this.files = options.files;
    this.body = options.body;
  }

  async fromHTTP(container : AwilixContainer, req: Req<V>): Promise<TImprovedRequest<V> | Error> {
    // should validate headers?
    if (this.headers != null) {
      const validHeaders = this.#headersChecker!.Check(req.headers);
      if (!validHeaders) {
        const errors = Array.from(this.#headersChecker!.Errors(req.headers));
        return new BadRequest(
          "Incorrect headers!\nThe following headers are expected in the request: " +
            Object.keys(this.headers).join(", ") +
            "!\nErrors produced: " +
            JSON.stringify(errors)
        );
      }
    }

    // should validate cookies ?
    if (this.cookies != null) {
      const parsedCookies = cookieParser(req.headers["cookie"] ?? "");
      const validCookies = this.#cookiesChecker!.Check(parsedCookies);
      if (!validCookies) {
        const errors = Array.from(this.#cookiesChecker!.Errors(parsedCookies));
        return new BadRequest(
          "Incorrect cookies!\nErrors produced: " + JSON.stringify(errors)
        );
      }
      (req as any).cookies = parsedCookies;
    }

    // should validate query string?
    if (this.query != null) {
      const parsedQueryString = queryStringParser(req.url ?? "");
      const validQueryString = this.#queryChecker!.Check(parsedQueryString);
      if (!validQueryString) {
        const errors = this.#queryChecker!.Errors(parsedQueryString);
        return new BadRequest(
          "Incorrect query string!\nErrors produced: " + JSON.stringify(errors)
        );
      }
      (req as any).queryString = parsedQueryString;
    }

    // should validate body
    if (this.body != null || this.files != null) {
      const validHeaders = this.bodyParser!.validateHeaders(
        req.headers as Record<string, string>
      );
      if (validHeaders instanceof Error) {
        return validHeaders;
      }
      const parseResult = await this.#bodyParser!.parse(req);
      if (parseResult instanceof Error) return parseResult;

      (req as any).body = parseResult.body;
      (req as any).files = parseResult.files;
    }

    (req as any).provide = (
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

    return req as TImprovedRequest<V>;
  }
}

export type TImprovedRequest<V extends HTTPVersion> = Req<V> & {
  [name: string]: any;
};

function extractContentType(header: string | undefined) {
  if (header == null) return "";
  const indexOfEqualSign = header.indexOf(";");
  if (indexOfEqualSign >= 0) {
    return header.substring(0, indexOfEqualSign);
  }
  return header;
}

export interface TRequestFactoryOptions {
  files?: TFileSchema;
  body?: TBodySchema;
  header?: THeaderSchema;
  query?: TQueryStringSchema;
  cookies?: TCookieSchema;

  maxBodySize?: number;
}
