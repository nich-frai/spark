import type { TBodyRestriction, TFileRestriction } from "#http/schema.js";
import type { AwilixContainer } from "awilix";
import { JSONParser } from "./json.js";
import { TextPlainParser } from "./text_plain.js";
import { MultipartParser } from "./multipart.js";
import { URLEncodedParser } from "./url_encoded.js";
import type { Transform } from "node:stream";
import type { Class } from "#http/utils.js";

export class BodyParser {
  
  static Parsers : Record<string, Class<Transform>> = {
    "application/json" : JSONParser,
    "text/plain" : TextPlainParser,
    "multipart/form-data" : MultipartParser,
    "application/x-www-urlencoded" : URLEncodedParser,
  };

  private options: TBodyParserOptions;

  constructor(
    private container: AwilixContainer,
    options: TBodyParserCreationOptions
  ) {
    this.options = {
      ...DefaultBodyParserOptions,
      ...options,
    };
  }
}

export const DefaultBodyParserOptions: TBodyParserOptions = {
  maxBodySize: 1024 * 1024 * 10, // 10Mb
  allowedContentTypes: Object.keys(BodyParser.Parsers),
};

export interface TBodyParserOptions {
  maxBodySize: number;
  allowedContentTypes: string[];
  fileSchema?: TFileRestriction;
  bodySchema?: TBodyRestriction;
}

export type TBodyParserCreationOptions = Partial<BodyParser>;
