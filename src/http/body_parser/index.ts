import { BadRequest } from "#http/http_error.js";
import { PinoLogger, type TLogger } from "#logger";
import type { HTTPVersion, Req } from "find-my-way";
import type { Transform } from "node:stream";
import type { TBodyRestriction, TFileRestriction } from "../schema.js";
import { JSONParser } from "./json.js";
import { MultipartParser } from "./multipart.js";
import { TextPlainParser } from "./text_plain.js";
import { URLEncodedParser } from "./url_encoded.js";

const DEFAULT_BODY_PARSER_OPTIONS: TBodyParserOptions = {
  maxBodySize: 1024 * 1024 * 10 /* 10mb */,
};

export class BodyParser {

  static Parsers = {
    "application/json": JSONParser,
    "multipart/form-data": MultipartParser,
    "text/plain": TextPlainParser,
    "application/": URLEncodedParser,
  };

  private _options: TBodyParserOptions;

  #logger : TLogger = new PinoLogger({name : "BodyParser"});

  constructor(options?: TBodyParserOptions) {
    this._options = {
      ...DEFAULT_BODY_PARSER_OPTIONS,
      ...options,
    };
  }

  validateHeaders(headers: Record<string, string | undefined>) {

    const expectedType = headers["content-type"];
    if (expectedType == null) {
      return new BadRequest(
        "Empty content-type! the request expects a data to be present in the request body but a content-type was not set!"
      );
    }
    this.#logger.debug(`Header validation: "${headers['content-type']}"`)

    const expectedBytes = parseInt(headers["content-length"] ?? "0") ?? 0;
    return true;
  }

  async parse(request : Req<HTTPVersion>) {
    const boundary = extractBoundaryFromHeader(request.headers['content-type']);
    if(boundary instanceof Error) return boundary;
    
    const parser = new MultipartParser({ boundary })

    parser.on('data', (data) => {
      this.#logger.debug('BodyParser received: ', data);
    })
    request.pipe(parser, { end : true })
    return new Promise((res, rej) => {
      parser.on('finish', res)
    });
  }
}

export interface TBodyParserOptions {
  maxBodySize?: number;
  allowedContentTypes? : string[];
  fieldsSchema? : TBodyRestriction;
  filesSchema? : TFileRestriction;
}

export interface IContentTypeBodyParser extends Transform {}

const BoundaryMatcher = /^multipart\/form-data;\s?boundary=(.*)$/i;

function extractBoundaryFromHeader(header : string | undefined) {

  if(header == null) {
    return new BadRequest('No content-type header avaliable! Cannot parse as multipart/form-data');
  }

  const matchesHeaders = header.match(BoundaryMatcher)

  if(matchesHeaders === null) {
    return new BadRequest('Bad content-type header! Cannot parse as multipart/form-data');
  }

  return matchesHeaders[1]
}