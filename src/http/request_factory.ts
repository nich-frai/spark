import { Type, type TSchema } from "@sinclair/typebox";
import { TypeCheck, TypeCompiler } from "@sinclair/typebox/compiler";
import type { HTTPVersion, Req } from "find-my-way";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TQueryStringRestriction,
} from "./schema";
import type { AwilixContainer, Resolver } from "awilix";

export class RequestFactory<V extends HTTPVersion> {
  #bodyChecker: TypeCheck<TSchema> | undefined;
  #body?: TBodyRestriction;
  get body() {
    return this.#body;
  }
  set body(body: TBodyRestriction | undefined) {
    this.#body = body;
    if (body != null)
      this.#bodyChecker = TypeCompiler.Compile(Type.Object(body));
    else this.#bodyChecker = undefined;
  }

  #headers?: THeaderRestriction;
  #headersChecker: TypeCheck<TSchema> | undefined;
  get headers() {
    return this.#headers;
  }
  set headers(header: THeaderRestriction | undefined) {
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

  #cookies?: TCookieRestriction;
  #cookiesChecker?: TypeCheck<TSchema> | undefined;
  get cookies() {
    return this.#cookies;
  }
  set cookies(cookies: TCookieRestriction | undefined) {
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

  #query?: TQueryStringRestriction;
  #queryChecker?: TypeCheck<TSchema> | undefined;
  get query() {
    return this.#query;
  }
  set query(query: TQueryStringRestriction | undefined) {
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

  #files?: TFileRestriction;
  // TODO: create file validation function
  #filesChecker?: unknown | undefined;
  get files() {
    return this.#files;
  }
  set files(files: TFileRestriction | undefined) {
    this.#files = files;
  }

  constructor(private container: AwilixContainer) {}

  fromHTTP(req: Req<V>) {
    // should validate headers?

    // should validate cookies ?

    // should validate query string?

    // should validate body ?

    // should validate files ?

    (req as any).provide = (
      nameOrRecord: string | Record<string, Resolver<unknown>>,
      provider?: Resolver<unknown>
    ) => {
      if (typeof nameOrRecord === "object" && provider == null) {
        this.container.register(nameOrRecord);
      }
      if (typeof nameOrRecord === "string" && provider != null) {
        this.container.register(nameOrRecord, provider);
      }
    };
    return req as TImprovedRequest<V>;
  }
}

export type TImprovedRequest<V extends HTTPVersion> = Req<V> & {
  [name: string]: any;
};
