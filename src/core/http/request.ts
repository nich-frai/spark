import type { AwilixContainer } from "awilix";
import type { HTTPMethod } from "find-my-way";
import type { File } from "formidable";
import type PersistentFile from "formidable/PersistentFile";
import type { Class, JsonValue, Merge } from "type-fest";
import type { HTTPIncomingHeaders, HTTPRoute } from "./route.js";
import type { HttpServer } from "./server.js";
import type {
  TSchema,
  TString,
  TOptional,
  TNumber,
  TBoolean,
  Static,
} from "@sinclair/typebox";

export type TRequestBody = {
  [name: string]: TSchema;
};

export type TRequestHeaders = {
  [name in HTTPIncomingHeaders]?: TString | TOptional<TString>;
};
export type TRequestCookies = { [name: string]: TString | TOptional<TString> };
export type TRequestURLParams = {
  [name: string]: TString | TOptional<TString>;
};
export type TRequestQueryParams = {
  [name: string]:
    | TString
    | TOptional<TString | TNumber | TBoolean>
    | TNumber
    | TBoolean;
};
export type TRequestFiles = Record<string, PersistentFile>;

export interface IHTTPRequestData<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Files extends TRequestFiles | undefined = undefined
> {
  id: string;

  _metadata: Record<string, unknown>;

  issuedAt: Date;

  url: string;

  method: HTTPMethod;

  headers: Merge<
    { [name in HTTPIncomingHeaders]?: string },
    { [name in keyof NonNullable<Headers>]-?: string }
  >;

  body: Body extends null | undefined
    ? undefined
    : {
        [key in keyof NonNullable<Body>]: Static<NonNullable<Body>[key]>;
      };

  urlParams?: URLParams extends null | undefined
    ? never
    : {
        [name in keyof NonNullable<URLParams>]: string;
      };

  queryParams?: QueryParams extends null | undefined
    ? never
    : {
        [name in keyof NonNullable<QueryParams>]: Static<
          NonNullable<QueryParams>[name]
        >;
      };

  cookies?: Cookies extends null | undefined
    ? never
    : {
        [name in keyof NonNullable<Cookies>]: string;
      };

  files?: Files extends null | undefined
    ? never
    : {
        [name in keyof NonNullable<Files>]: File;
      };

  provide(
    name: string,
    value: (Class<any> | ((...args: any) => any)) | JsonValue
  ): void;
}

export interface IHTTPRequestContext {
  server: HttpServer;
  route: HTTPRoute;
  container: AwilixContainer;
}

export type TRequestType<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Files extends TRequestFiles | undefined = undefined
> = Omit<
  IHTTPRequestData,
  "body" | "urlParams" | "queryParams" | "cookies" | "files"
> &
  (Body extends undefined
    ? {}
    : {
        body: {
          [key in keyof NonNullable<Body>]: Static<NonNullable<Body>[key]>;
        };
      }) &
  (Headers extends undefined
    ? {}
    : {
        headers: Merge<
          { [name in HTTPIncomingHeaders]?: string },
          { [name in keyof NonNullable<Headers>]-?: string }
        >;
      }) &
  (Cookies extends undefined
    ? {}
    : {
        cookies: {
          [name in keyof NonNullable<Cookies>]: string;
        };
      }) &
  (URLParams extends undefined
    ? {}
    : {
        urlParams: {
          [name in keyof NonNullable<URLParams>]: string;
        };
      }) &
  (QueryParams extends undefined
    ? {}
    : {
        queryParams: {
          [name in keyof NonNullable<QueryParams>]: Static<
            NonNullable<QueryParams>[name]
          >;
        };
      }) &
  (Files extends undefined
    ? {}
    : {
        files: {
          [name in keyof NonNullable<Files>]: File;
        };
      });
