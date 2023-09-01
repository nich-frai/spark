import type { HTTPVersion, Req } from "find-my-way";
import type {
  TBodySchema,
  TCookieSchema,
  TFileSchema,
  THeaderSchema,
  TInferBody,
  TInferCookie,
  TInferFile,
  TInferHeader,
  TInferQueryString,
  TQueryStringSchema,
  TRouteSchema,
} from "./schema.js";
import type { Expand } from "./utils.js";

export type TRequest<TSchema extends TRouteSchema> = Req<HTTPVersion> &
  // File infer
  (TSchema["files"] extends TFileSchema
    ? { files: Expand<TInferFile<TSchema["files"]>>  }
    : {}) &
  // Body infer
  (TSchema["body"] extends TBodySchema
    ? {} extends TSchema["body"]
      ? {}
      : { body: Expand<TInferBody<TSchema["body"]>>}
    : {}) &
  // Query string infer
  (TSchema["queryString"] extends TQueryStringSchema
    ? {} extends TSchema["queryString"]
      ? {}
      : { queryString: Expand<TInferQueryString<TSchema["queryString"]>> }
    : {}) &
  // Header infer
  (TSchema["headers"] extends THeaderSchema
    ? {} extends TSchema["headers"]
      ? { headers: Record<string, string | undefined> }
      : { headers: Expand<TInferHeader<TSchema["headers"]>>  }
    : { headers: Record<string, string | undefined> }) &
  // Cookie infer
  (TSchema["cookies"] extends TCookieSchema
    ? {} extends TSchema["cookies"]
      ? {}
      : { cookies: Expand<TInferCookie<TSchema["cookies"]>>  }
    : // URL params, will always be strings ? infer basic params from url ?
      {}) & { urlParams: Record<string | number, string | undefined> } ;
