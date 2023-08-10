import type { HTTPVersion, Req } from "find-my-way";
import type {
  TBodyRestriction,
  TCookieRestriction,
  TFileRestriction,
  THeaderRestriction,
  TInferBody,
  TInferCookie,
  TInferFile,
  TInferHeader,
  TInferQueryString,
  TQueryStringRestriction,
} from "./schema.js";
import type { Merge } from "type-fest";

export type TRequest<TBody, TQueryString, THeader, TCookie, TFile> =
  Req<HTTPVersion> &
    // File infer
    (TFile extends TFileRestriction
      ? { files: () => Promise<TInferFile<TFile>> }
      : {}) &
    // Body infer
    (TBody extends TBodyRestriction
      ? {} extends TBody
        ? {}
        : { body: TInferBody<TBody>  }
      : {}) &
    // Query string infer
    (TQueryString extends TQueryStringRestriction
      ? {} extends TQueryString
        ? {}
        : { queryString: TInferQueryString<TQueryString> }
      : {}) &
    // Header infer
    (THeader extends THeaderRestriction
      ? {} extends THeader
        ? { headers: Record<string, string | undefined> }
        : { headers: TInferHeader<THeader> }
      : { headers: Record<string, string | undefined> }) &
    // Cookie infer
    (TCookie extends TCookieRestriction
      ? {} extends TCookie
        ? {}
        : { cookies: TInferCookie<TCookie> }
        // URL params, will always be strings ? infer basic params from url ?
      : {}) & { urlParams: Record<string | number, string | undefined> };
