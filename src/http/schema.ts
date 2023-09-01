import type { TOptional, TSchema, TString } from "@sinclair/typebox";
import type { Infer } from "#type";
import type { Readable, ReadableOptions } from "node:stream";

export type TServicesSchema =
  | [] // empty array
  | [unknown, ...unknown[]];

export type TBodySchema = {
  [name: string]: TSchema;
};

export type TQueryStringSchema = {
  [name: string]: true | TString | TOptional<TString>;
};

export type TCookieSchema = {
  [name: string]: true | TString | TOptional<TString>;
};

export type THeaderSchema = {
  [name: string]: true | TString | TOptional<TString>;
};

export type TFileSchema = {
  [name: string]: true | TFileFieldOption;
};

export type TFileFieldOption = TSingleFileOption | TMultipleFileOption;

/**
 * Single file options
 * ------------------
 * Defined the field options that will accept a single file (not-multiple)
 */
export interface TSingleFileOption {
  /**
   * Max file size
   * -------------
   * the maximum individual file size in bytes
   * @default 10mb 10 * 1024 * 1024
   */
  maxFileSize?: number;
  /**
   * Allowed mime types
   * ------------------
   * Describe the allowed mime types for this field, there are helpers for common files sucha as image, pdf document, word document, video, music in MimeTypes constant
   */
  allowedMimeTypes?: string | string[];
}
/**
 * Multiple file options
 * -----------------------
 * Define the field options that shall accept more than one file (array of files)
 */
export interface TMultipleFileOption {
  multiple: true;
  /**
   * Max file size
   * -------------
   * the maximum individual file size in bytes
   * @default 10mb 10 * 1024 * 1024
   */
  maxFileSize?: number;
  /**
   * Allowed mime types
   * ------------------
   * Describe the allowed mime types for this field, there are helpers for common files sucha as image, pdf document, word document, video, music in MimeTypes constant
   */
  allowedMimeTypes?: string | string[];
  /**
   * Minimum amount of items
   * -----------------------
   * Describe the minimum amount of files to be expected, POSITIVE INTEGER value
   * @default 0
   */
  min?: number;
  /**
   * Maximum amount of items
   * -----------------------
   * Describe the maximum amount of files to be expected, POSITIVE INTEGER, must be greater than "min"
   * @default Infinity
   */
  max?: number;
}


export interface TRouteSchema {
  body? : TBodySchema;
  files? : TFileSchema;
  cookies? : TCookieSchema;
  queryString? : TQueryStringSchema;
  headers? : THeaderSchema;
}

export interface TMiddlewareSchema {
  body? : TBodySchema;
  cookies? : TCookieSchema;
  queryString? : TQueryStringSchema;
  headers? : THeaderSchema;
}

export const MimeTypes = {
  Audio: [
    "audio/3gpp", // .3gp
    "audio/3gpp2", // .3g2
    "audio/aac",
    "audio/ac3",
    "audio/eac3",
    "audio/mp4", //mp4
    "audio/mpeg", //.mp3 OR .mpeg
    "audio/ogg", //.ogg OR .oga
    "audio/opus", //.opus
    "audio/x-aiff", //.aiff
    "audio/l24", //.
    "audio/x-mpegurl", //.m3a
    "audio/vorbis", //.vorbis
    "audio/vnd.wav", //.wav
    "audio/wav",
    "audio/x-cdf", // .cda
    "audio/midi", //.mid OR .midi
    "audio/x-midi",
    "audio/webm", //.weba
  ],
  Image: [
    "image/avif", // .avif
    "image/bmp", // .bmp
    "image/gif", // .gif
    "image/vnd.microsoft.icon", // .ico
    "image/jpeg", // .jpg OR .jpeg
    "image/png", // .png
    "image/svg+xml", // .svg
    "image/tiff", // .tif OR .tiff
    "image/webp", // .webp
  ],
  Video: [
    "video/x-msvideo", // .avi
    "video/mpeg", //.mpeg
    "video/ogg", //.ogv
    "video/webm", //.webm
    "video/x-matroska", //.mkv, not endoresed by IANA!
    "video/mp4", //.mp4
    "video/av1",
    "video/H264",
    "video/H265",
    "video/jpeg",
    "video/quicktime",
    "video/VP8",
    "video/VP9",
  ],

  PDF: ["application/pdf"],
  Word: [
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", //.docx
    "application/vnd.oasis.opendocument.text", // .odt
    "application/x-abiword", // .abw
  ],
  Spreadsheet: [
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.oasis.opendocument.spreadsheet", // .ods
  ],
  Presentation: [
    "application/vnd.ms-powerpoint", //.ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", //.pptx
    "application/vnd.oasis.opendocument.presentation", //.odp
  ],
};

export type TInferBody<T extends TBodySchema> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
};

export type TInferQueryString<T extends TQueryStringSchema> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
};

export type TOptionalKeys<T extends { [name: string]: unknown }> = {
  [name in keyof T]: T[name] extends TOptional<TSchema> ? name : never;
}[keyof T];

export type TInferHeader<T extends THeaderSchema> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
} & {
  [name: string]: string | undefined;
};

export type TInferCookie<T extends TCookieSchema> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
};

export type TInferFile<T extends TFileSchema> = {
  [name in keyof T]: T[name] extends TSingleFileOption
    ? TFileInfo
    : TFileInfo[];
};

export interface TFileInfo {
  originalFilename: string;
  filename: string;
  filepath: string;
  contentType: string;
  size: number;
  readableStream(options? : ReadableOptions): Readable;
}
