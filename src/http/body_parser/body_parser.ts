import {
  BadRequest,
  PayloadTooLarge,
  UnsupportedMediaType,
} from "#http/http_error.js";
import { PinoLogger, type TLogger } from "#logger";
import type { HTTPVersion, Req } from "find-my-way";
import { Writable, type Transform, Readable, Duplex } from "node:stream";
import type {
  TBodyRestriction,
  TFileInfo,
  TFileRestriction,
} from "../schema.js";
import { JSONParser } from "./json.js";
import { MultipartParser } from "./multipart.js";
import { TextPlainParser } from "./text_plain.js";
import { URLEncodedParser } from "./url_encoded.js";
import type { AwilixContainer } from "awilix";
import type { Class } from "type-fest";
import { createReadStream } from "node:fs";

type BodyParserClass = Class<
  Transform,
  [AwilixContainer, TBodyParserOptions & { boundary: string; logger?: TLogger }]
>;

export class BodyParser {
  static Parsers: Record<string, BodyParserClass> = {
    "application/json": JSONParser,
    "multipart/form-data": MultipartParser,
    "text/plain": TextPlainParser,
    "application/x-www-form-urlencoded": URLEncodedParser,
  };

  private _options: TBodyParserOptions;

  #logger: TLogger = new PinoLogger({ name: "BodyParser" });

  constructor(
    private container: AwilixContainer,
    options?: TBodyParserCreationOptions
  ) {
    this._options = {
      ...DEFAULT_BODY_PARSER_OPTIONS,
      ...options,
    };
  }

  validateHeaders(headers: Record<string, string | undefined>) {
    let contentType = extractContentType(headers["content-type"]);
    if (contentType instanceof Error) {
      return contentType;
    }
    contentType = contentType.trim().toLocaleLowerCase();

    if (
      // Content type not supported (no parser set)
      !Object.keys(BodyParser.Parsers).includes(contentType) ||
      // Content type not allowed for this route
      !this._options.allowedContentTypes.includes(contentType)
    ) {
      this.#logger.debug(
        `Content-Type "${contentType}" is not supported by this route body parser! Allowed/supported content-types: ${this._options.allowedContentTypes.join(
          ", "
        )}`
      );
      return new UnsupportedMediaType(
        `Content-Type "${contentType}" is not supported by this route body parser! Allowed/supported content-types: ${this._options.allowedContentTypes.join(
          ", "
        )}`
      );
    }

    if (headers["content-length"] != null) {
      const expectedBytes = parseInt(headers["content-length"]);
      if (expectedBytes > this._options.maxBodySize) {
        return new PayloadTooLarge(
          `Max allowed body size of this route ${this._options.maxBodySize} bytes! Receiving: ${expectedBytes}`
        );
      }
    }

    return true;
  }

  async parse(request: Req<HTTPVersion>) {
    // check content-type
    let contentType = extractContentType(request.headers["content-type"]!);
    if (contentType instanceof Error) return contentType;
    contentType = contentType.trim().toLocaleLowerCase();

    const boundary: string | Error =
      contentType === "multipart/form-data"
        ? extractBoundaryFromHeader(request.headers["content-type"])
        : "";
    if (boundary instanceof Error) return boundary;

    // parse incoming data
    const parserClass = BodyParser.Parsers[contentType];
    const parser = new parserClass(this.container, {
      ...this._options,
      logger: this.#logger,
      boundary,
    });

    let body = Object.create(null);
    let files: Record<string, TFileInfo | TFileInfo[]> = Object.create(null);

    // react to data being parsed
    parser.on("data", (data: TBodyParserPartInfo) => {
      switch (data.type) {
        // Field part, indicates a single field/value pair, an array is to be created if there were previous values with the same fieldname
        case "field":
          this.#logger.debug(
            `Received form field:${data.name} -> ${data.content} | Size: ${data.size}`
          );

          // TODO: decide if we shall support nested object notation in field name

          // check if name is previously set
          if (body[data.name] != null) {
            if (!Array.isArray(body[data.name])) {
              body[data.name] = [body[data.name]];
            }
            body[data.name].push(data.content);
          } else {
            body[data.name] = data.content;
          }

          break;

        // File part, sent using multipart/form-data
        case "file":
          this.#logger.debug(
            `Received form file:  "${
              data.name
            }": "${data.originalFilename!}" -> "${data.filename}" | Size: ${
              data.size
            }`
          );

          const fileInfo: TFileInfo = {
            contentType: data.contentType,
            filename: data.filename,
            filepath: data.filepath,
            originalFilename: data.originalFilename ?? "",
            size: data.size,
            readableStream(options) {
              return createReadStream(data.filepath, options);
            },
          };

          if (files[data.name] != null) {
            if (!Array.isArray(files[data.name])) {
              files[data.name] = [files[data.name] as TFileInfo];
            }
            (files[data.name] as TFileInfo[]).push(fileInfo);
          } else {
            files[data.name] = fileInfo;
          }

          break;

        // Object is usually passed with 'non-streamable' content, like application/json, we should consider it as the body of our request!
        case "object":
          this.#logger.debug(`Received form object! Using it as body `);

          // if value is a primitive it becomes the body itself
          if (
            ["string", "number", "boolean", "bigint", "undefined"].includes(
              typeof data.content
            )
          ) {
            body = data.content;
          } else if (typeof data.content === "object") {
            if (Array.isArray(data.content)) {
              body = data.content;
            } else {
              Object.assign(body, data.content);
            }
          } else {
            this.#logger.warn(
              `Parser object is of unknown/unsupported type: "${typeof data.content}"!\nIts content shall be ignored`
            );
          }
          break;
      }
    });

    request.pipe(parser, { end: true });

    return new Promise<{
      body: unknown;
      files: Record<string, TFileInfo | TFileInfo[]>;
    }>((res, rej) => {

      parser.once("error", (err: Error, part: any) => {
        this.#logger.debug(
          `Error raised while processing part ${part.type} - ${part.name}!`,
          err.toString(),
          part.filename
        );
        rej(err);
      });

      parser.once("end", () => {
        res({
          body,
          files,
        });
      });
    });
  }
}

const DEFAULT_BODY_PARSER_OPTIONS: TBodyParserOptions = {
  maxBodySize: 1024 * 1024 * 10 /* 10mb */,
  allowedContentTypes: Object.keys(BodyParser.Parsers),
};

export interface TBodyParserOptions {
  maxBodySize: number;
  allowedContentTypes: string[];
  bodySchema?: TBodyRestriction;
  fileSchema?: TFileRestriction;
}
export type TBodyParserCreationOptions = Partial<TBodyParserOptions>;

export interface IContentTypeBodyParser extends Transform {}

const BoundaryMatcher = /^multipart\/form-data;\s?boundary=(.*)$/i;

function extractBoundaryFromHeader(header: string | undefined) {
  if (header == null) {
    return new BadRequest(
      "No content-type header avaliable! Cannot parse as multipart/form-data"
    );
  }

  const matchesHeaders = header.match(BoundaryMatcher);

  if (matchesHeaders === null) {
    return new BadRequest(
      "Bad content-type header! Cannot parse as multipart/form-data"
    );
  }

  return matchesHeaders[1];
}

function extractContentType(header: string | undefined) {
  if (header == null) {
    return new BadRequest(
      "No content-type header avaliable! Cannot parse as multipart/form-data"
    );
  }

  return header.indexOf(";") >= 0
    ? header.substring(0, header.indexOf(";"))
    : header;
}

export type TBodyParserPartInfo =
  | TBodyParserPartField
  | TBodyParserPartFile
  | TBodyParserPartObject
  | TBodyParserPartUnknown;

export interface TBodyParserPartFile {
  type: "file";
  name: string;
  filename: string;
  filepath: string;
  originalFilename?: string;
  contentType: string;
  content?: Readable;
  size: number;
}

export interface TBodyParserPartField {
  type: "field";
  name: string;
  contentType: string;
  content: string;
  size: number;
}

export interface TBodyParserPartObject {
  type: "object";
  content: Record<string, unknown> | any[] | string | number | boolean;
  size: number;
}

export interface TBodyParserPartUnknown {
  type: "unknown";
  content: unknown;
  name?: string;
  filename?: string;
  originalFilename?: string;
  contentType: string;
  charset?: string;
  size: number;
}

export interface TBodyParserPartAny {
  type: string;
  content: unknown;
  name?: string;
  filename?: string;
  filepath?: string;
  originalFilename?: string;
  contentType: string;
  charset?: string;
  size: number;
}
