import type { Resolver } from "awilix";
import type { TRequest } from "./request.js";
import type { HTTPResponse, TResponse } from "./response.js";
import type {
  TBodyRestriction,
  TQueryStringRestriction,
  THeaderRestriction,
  TCookieRestriction,
  TFileRestriction,
  TServicesRestriction,
} from "./schema.js";

export interface TRequestMiddleware<
  TBody extends TBodyRestriction,
  TQueryString extends TQueryStringRestriction,
  THeader extends THeaderRestriction,
  TCookie extends TCookieRestriction,
  TFile extends TFileRestriction,
  TServices extends TServicesRestriction
> {
  // schema
  body?: TBody;
  queryString?: TQueryString;
  header?: THeader;
  cookie?: TCookie;
  file?: TFile;

  handle(
    req: TRequest<TBody, TQueryString, THeader, TCookie, TFile> &
      TRegisterDependency,
    res: TResponse,
    ...services: TServices
  ): unknown | void | Error | HTTPResponse | Promise<Error | HTTPResponse>;
}

export interface TResponseMiddleware {
  handle(
    response : HTTPResponse
  ) : HTTPResponse | Error | Promise<HTTPResponse | Error>
}


type TRegisterDependency = {
  registerDependency(name: string, provider: Resolver<unknown>): void;
  registerDependency(register: Record<string, Resolver<unknown>>): void;
};

export type TAnyMiddleware = TRequestMiddleware<any, any, any, any, any, any>;


export function requestMiddleware() {
  
}