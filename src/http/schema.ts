import type { TOptional, TSchema, TString } from "@sinclair/typebox";
import type { FileInfo } from "busboy";
import type { Infer } from "#type";
export type TServicesRestriction =
  | [] // empty array
  | [unknown, ...unknown[]];

export type TBodyRestriction = {
  [name : string] : TSchema
}

export type TQueryStringRestriction = {
  [name : string]: true | TString | TOptional<TString>;
};

export type TCookieRestriction = {
  [name : string]: true | TString | TOptional<TString>;
};

export type THeaderRestriction = {
  [name : string]: true | TString | TOptional<TString>;
};

export type TFileRestriction = {
  [name : string]: true | TFileFieldOption;
};

export type TFileFieldOption = TSingleFileOption | TMultipleFileOption;

/**
 * Single file options
 * ------------------
 * Defined the field options that will accept a single file (not-multiple)
 */
export interface TSingleFileOption {
  multiple?: undefined | false;
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

export const MimeTypes = {
  Audio: [],
  Image: [],
  PDF: [],
  Word: [],
  Spreadsheet: [],
  Video: [],
  Presentation: [],
};

export type TInferBody<T extends TBodyRestriction> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
}

export type TInferQueryString<T extends TQueryStringRestriction> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
};

export type TOptionalKeys<T extends { [name : string] : unknown }> = {
  [name in keyof T] : T[name] extends TOptional<TSchema> ? name : never
}[keyof T];

export type TInferHeader<T extends THeaderRestriction> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
} & {
  [name: string]: string | undefined;
};

export type TInferCookie<T extends TCookieRestriction> = {
  [name in keyof T]: T[name] extends TSchema ? Infer<T[name]> : string;
};

export type TInferFile<T extends TFileRestriction> = {
  [name in keyof T]: T[name] extends TSingleFileOption ? FileInfo : FileInfo[];
};
