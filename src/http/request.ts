import type { IncomingMessage } from "node:http";
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

export type TRequest<TBody, TQueryString, THeader, TCookie, TFile> =
  IncomingMessage & 
   ( TFile extends TFileRestriction ? { files : () => Promise<TInferFile<TFile>> } : {} ) &
   ( TBody extends TBodyRestriction ? {} extends TBody ? {} : { body :  () => TInferBody<TBody> } : {} ) &
  {
    queryString: TQueryString extends TQueryStringRestriction
      ? () => TInferQueryString<TQueryString>
      : never;
    headers: THeader extends THeaderRestriction
      ? () => TInferHeader<THeader>
      : Record<string, string | undefined>;
    cookies: TCookie extends TCookieRestriction
      ? () => TInferCookie<TCookie>
      : never;
  };
