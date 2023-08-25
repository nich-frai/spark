import {
  BadRequest,
  PayloadTooLarge,
  UnsupportedMediaType,
} from "#http/http_error.js";
import { PinoLogger, type TLogger } from "#logger";
import type { AwilixContainer } from "awilix";
import { customAlphabet, urlAlphabet } from "nanoid";
import { createWriteStream, existsSync, mkdirSync, rm, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Transform, Writable, type TransformCallback } from "node:stream";
import type {
  TBodyParserOptions,
  TBodyParserPartAny,
  TBodyParserPartFile,
} from "./body_parser.js";
import type { TFileFieldOption } from "#http/schema.js";

export class MultipartParser extends Transform {
  static DefaultCreateFileWritableStream = DefaultCreateFileWritableStream;

  #logger: TLogger;

  private _contentDispositionLookupIndex = 0;
  private _partNameLookupIndex = 0;
  private _filenameLookupIndex = 0;
  private _endOfStreamLookupIndex = 0;
  private _newPartLookupIndex = 0;
  private _delimiterLookupIndex = 0;

  private _partHeaderLineBuffer?: Buffer;
  private _partName = "";
  private _partFilename = "";
  private _part: TBodyParserPartAny & {
    content: Writable | string;
    error?: Error;
  } = {
    type: "field",
    name: "",
    contentType: "text/plain",
    content: "",
    size: 0,
  };

  private state: TMultipartScannerState = ScannerState.NOT_SET;
  private boundaryDelimiter: Buffer;

  private bytesReceived: number = 0;

  _start: number = 0;

  private _processedParts: Record<string, TProcessedPartInfo> = {};

  constructor(
    private container: AwilixContainer,
    private options: TMultipartParserOptions
  ) {
    super({ readableObjectMode: true });

    if (options.logger == null) {
      this.#logger = new PinoLogger({ name: "MultipartParser" });
    } else {
      this.#logger = options.logger.child("MultipartParser");
    }

    this.boundaryDelimiter = Buffer.concat([
      DELIMITER_START,
      Buffer.from(options.boundary),
    ]);

    this._createFileWritableStream =
      options.createFileWritableStream ??
      MultipartParser.DefaultCreateFileWritableStream;

    this._start = performance.now();
  }

  setState(state: TMultipartScannerState) {
    this.state = state;

    if (state === ScannerState.CHECK_PART_HEADER_VALIDITY) {
      this._part.type = "field";
      this._part.name = "";
      this._part.content = null as any;
      this._part.size = 0;
      this._part.contentType = "text/plain";
      this._part.error = undefined;

      this._contentDispositionLookupIndex = 0;
    }

    if (state === ScannerState.LOOKUP_NAME_OF_PART) {
      this._partNameLookupIndex = 0;
    }

    if (state === ScannerState.ACQUIRE_PART_NAME) {
      this._partName = "";
    }

    if (state === ScannerState.CHECK_FOR_FILENAME_OR_END_OF_HEADER) {
      this._filenameLookupIndex = 0;
    }

    if (state === ScannerState.ACQUIRE_PART_FILENAME) {
      this._partFilename = "";
    }

    if (state === ScannerState.CHECK_FOR_OTHER_PART_HEADERS) {
      delete this._partHeaderLineBuffer;
    }

    if (state === ScannerState.ACQUIRE_PART_CONTENT) {
      this._checkTypeOfPartContent();
    }

    if (state == ScannerState.CHECK_FOR_END_OF_STREAM) {
      this._endOfStreamLookupIndex = 0;
      this._newPartLookupIndex = 0;
      this._delimiterLookupIndex = 0;
    }
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding | "buffer",
    callback: TransformCallback
  ): void {
    this.bytesReceived += chunk.length;

    if (this.bytesReceived > this.options.maxBodySize) {
      this.#logger.warn("Bytes received are greater than allowed, skip!");
      callback(new PayloadTooLarge(""));
      return;
    }

    let startAt = 0;

    // Check for initial boundary position, everything before it shall be ignored!
    if (this.state === ScannerState.NOT_SET) {
      const indexOfBoundary = chunk.indexOf(this.boundaryDelimiter);
      // no boundary present? incorrect message format
      if (indexOfBoundary < 0) {
        callback(
          new BadRequest(
            "Error processing request body! multipart/form-data boundary specified in header was not found!"
          )
        );
        return;
      }
      startAt = indexOfBoundary + this.boundaryDelimiter.length;
      this.setState(ScannerState.CHECK_PART_HEADER_VALIDITY);
    }

    for (let a = startAt; a < chunk.length; a++) {
      // 1st task is to verify if the "part" header is valid!
      if (this.state === ScannerState.CHECK_PART_HEADER_VALIDITY) {
        if (
          // ignore \r\n at the beggining of the lookup, probably dirt from previous iteration
          (chunk[a] === CARRIAGE_RETURN || chunk[a] === NEW_LINE) &&
          this._contentDispositionLookupIndex === 0
        ) {
          continue;
        }
        // By RFC 7578 each part MUST contain a Content-Disposition header field (the header may come truncated?)
        if (
          chunk[a] !==
            HEADER_CONTENT_DISPOSITION[this._contentDispositionLookupIndex] &&
          chunk[a] !==
            HEADER_CONTENT_DISPOSITION_LOWER[
              this._contentDispositionLookupIndex
            ]
        ) {
          this.#logger.debug(`Incorrect form data request!
Boundary not followed by content disposition header in part!
Chunk position: ${a}, value: ${chunk[a]}, string: "${chunk
            .subarray(a, a + 20)
            .toString()}"
Header position: ${this._contentDispositionLookupIndex}, value: ${
            HEADER_CONTENT_DISPOSITION[this._contentDispositionLookupIndex]
          }`);

          callback(
            new BadRequest(
              "Incorrect body request! A part should ALWAYS start with content-disposition header! (by RFC 7578)"
            )
          );
          return;
        }
        this._contentDispositionLookupIndex++;

        // We reached the end of the comparison and no errors raised! go to next stage!
        if (
          this._contentDispositionLookupIndex ===
          HEADER_CONTENT_DISPOSITION.length
        ) {
          this.setState(ScannerState.LOOKUP_NAME_OF_PART);
          continue;
        }
      }

      // 2nd task is check if the name is present in the content-disposition header
      if (this.state === ScannerState.LOOKUP_NAME_OF_PART) {
        // Ignore white spaces
        if (chunk[a] === WHITE_SPACE) {
          continue;
        }

        if (chunk[a] !== HEADER_PART_NAME[this._partNameLookupIndex]) {
          this.#logger.debug(
            "Failed to find name in content-disposition header!",
            chunk.subarray(a, 20).toString(),
            this._partNameLookupIndex
          );
          callback(
            new BadRequest(
              "Incorrect body request! A part should ALWAYS declare the field name in the content disposition header!"
            )
          );
          return;
        }
        this._partNameLookupIndex++;

        // We reached the end of the comparison and no errors raised! go to name acquisition phase!
        if (this._partNameLookupIndex === HEADER_PART_NAME.length) {
          this.setState(ScannerState.ACQUIRE_PART_NAME);
          continue;
        }
      }

      // 3rd task is to acquire the part name, concat it until we see the closing quotation
      if (this.state === ScannerState.ACQUIRE_PART_NAME) {
        // double quotes == end of name string! stop acquisition
        if (chunk[a] === DOUBLE_QUOTE) {
          this._part.name = this._partName;
          this.setState(ScannerState.CHECK_FOR_FILENAME_OR_END_OF_HEADER);
          continue;
        }

        // new line of line feed == error?
        if (chunk[a] === CARRIAGE_RETURN || chunk[a] === NEW_LINE) {
          callback(
            new BadRequest(
              "Incorrect body request! A part name cannot contain a new line!"
            )
          );
          return;
        }
        this._partName += String.fromCharCode(chunk[a]);
      }

      // 4th task verify if there's a file name present
      if (this.state === ScannerState.CHECK_FOR_FILENAME_OR_END_OF_HEADER) {
        // Ignore white spaces
        if (chunk[a] === WHITE_SPACE) {
          continue;
        }

        // check if we reached the carriage return
        if (
          chunk[a] === CARRIAGE_RETURN &&
          a + 1 < chunk.length &&
          chunk[a + 1] === NEW_LINE
        ) {
          // Skip "NEW_LINE"
          a++;
          this.setState(ScannerState.CHECK_FOR_OTHER_PART_HEADERS);
          continue;
        }

        // if it matches with the filename, add to the index
        if (chunk[a] === HEADER_FILENAME[this._filenameLookupIndex]) {
          this._filenameLookupIndex++;
        } else {
          this._filenameLookupIndex = 0;
        }

        // We reached the end of the comparison and no errors raised! go to filename acquisition phase!
        if (this._filenameLookupIndex === HEADER_FILENAME.length) {
          this.setState(ScannerState.ACQUIRE_PART_FILENAME);
          continue;
        }
      }

      // 5th task acquire filename (when present)
      if (this.state === ScannerState.ACQUIRE_PART_FILENAME) {
        // double quotes == end of name string! stop acquisition
        if (chunk[a] === DOUBLE_QUOTE) {
          this._part.filename = this._partFilename;
          this._part.originalFilename = this._partFilename;
          this.setState(ScannerState.CHECK_FOR_FILENAME_OR_END_OF_HEADER);
          continue;
        }

        // new line of line feed == error?
        if (chunk[a] === CARRIAGE_RETURN || chunk[a] === NEW_LINE) {
          callback(
            new BadRequest(
              "Incorrect body request! A part filename cannot contain a new line!"
            )
          );
          return;
        }
        this._partFilename += String.fromCharCode(chunk[a]);
      }

      // 6th task verify other headers
      if (this.state === ScannerState.CHECK_FOR_OTHER_PART_HEADERS) {
        let lastLinePosition = a;
        for (let b = a; b < chunk.length - 1; b++) {
          if (chunk[b] === CARRIAGE_RETURN && chunk[b + 1] === NEW_LINE) {
            // END OF HEADERS - CRLF at the start of the line?
            if (b === lastLinePosition) {
              a = lastLinePosition + 2;
              this.setState(ScannerState.ACQUIRE_PART_CONTENT);
              break;
            }

            let lineContent: Buffer;
            if (this._partHeaderLineBuffer != null) {
              lineContent = Buffer.concat([
                this._partHeaderLineBuffer,
                chunk.subarray(lastLinePosition, b),
              ]);
              delete this._partHeaderLineBuffer;
            } else {
              lineContent = chunk.subarray(lastLinePosition, b);
            }
            this._processPartHeader(lineContent);
            lastLinePosition = b + 2;
            continue;
          }
        }

        // we have not reached the header end and exhausted the chunk length, add everything to the "line buffer" and wait for the next iteration
        if (this.state === ScannerState.CHECK_FOR_OTHER_PART_HEADERS) {
          this._partHeaderLineBuffer = chunk.subarray(a);
          break;
        }
      }

      // 7th task pump data until the boundary is found
      if (this.state === ScannerState.ACQUIRE_PART_CONTENT) {

        const remainingChunk = chunk.subarray(a);
        // search for boundary
        const ioDelimiter = remainingChunk.indexOf(this.boundaryDelimiter);

        // found it
        if (ioDelimiter >= 0) {
          // content to be appended
          const appendToContent = chunk.subarray(a, a + ioDelimiter);
          
          this._appendToPartContent(appendToContent);
          this._endPart();
          this.setState(ScannerState.CHECK_FOR_END_OF_STREAM);

          // fast-forward array iteration until after boundary
          a += ioDelimiter + this.boundaryDelimiter.length - 1;
         
          continue;
        }
        // not found it, append everything to content 
        else {
          this._appendToPartContent(remainingChunk);
          break;
        }
      }

      // 8th task, check after collecting the part if the stream has ended or there are other parts
      if (this.state === ScannerState.CHECK_FOR_END_OF_STREAM) {
        // if delimiter is found:
        if (chunk[a] === DELIMITER_START[this._endOfStreamLookupIndex]) {
          this._endOfStreamLookupIndex++;
          this._delimiterLookupIndex++;
        }

        if (chunk[a] === CRLF[this._endOfStreamLookupIndex]) {
          this._endOfStreamLookupIndex++;
          this._newPartLookupIndex++;
        }

        if (this._endOfStreamLookupIndex === 2) {
          if (this._newPartLookupIndex === 2) {
            this.setState(ScannerState.CHECK_PART_HEADER_VALIDITY);
            continue;
          }

          if (this._delimiterLookupIndex === 2) {
            this.setState(ScannerState.END_OF_STREAM);
            break;
          }
          callback(
            new BadRequest(
              `Incorrect body format! After a boundary we expect either \\r\\n (CRLF) for a new part or the ending delimiter "--"! None of both was passed!`
            )
          );
          return;
        }
      }
    }
    
    callback();
  }

  private _processPartHeader(header: string | Buffer) {
    if (typeof header != "string") header = header.toString();
    header = header.toLocaleLowerCase().trim();

    // valid header: content-type!
    if (header.startsWith(HEADER_CONTENT_TYPE)) {
      if (header.indexOf(";") >= 0) {
        this._part.contentType = header.substring(
          HEADER_CONTENT_TYPE.length - 1,
          header.indexOf(";")
        );
        const charsetString = header.substring(header.indexOf(";"));
        if (charsetString.startsWith("charset=")) {
          this._part.charset = charsetString.substring("charset=".length - 1);
        }
      } else {
        this._part.contentType = header
          .substring("content-type:".length)
          .trim();
      }

      return;
    }

    // Valid but deprecated header: content-transfer-encoding
    //TODO: ? should implement a deprecated feature ?
    if (header.startsWith("content-transfer-encoding:")) {
      this.#logger.warn(
        'A valid, but deprecated, header "content-transfer-encoding" was found! Not implemented in this parser!'
      );
      return;
    }
  }

  private _appendToPartContent(content: Buffer) {
    const part = this._part;

    // if an error was raised before, skip appending
    if (part.error != null) {
      return;
    }

    const typeOfPart = part.type;
    const fieldName = part.name;

    if (fieldName == null) {
      this.#logger.debug(
        `No part name was set in the header! Part content will be ignored (bad syntax ?)`
      );
      return;
    }

    switch (typeOfPart) {
      case "file": {
        if (this.options.fileSchema == null) {
          this.#logger.debug(
            `No file schema was set for the parser! File content will be ignored`
          );
          return;
        }

        const isFieldPresentInSchema = fieldName in this.options.fileSchema;
        if (!isFieldPresentInSchema) {
          this.#logger.debug(
            `File field "${fieldName}" is not present in the file schema! Known file fields: ${Object.keys(
              this.options.fileSchema
            ).join(",")}`
          );
          return;
        }

        // initialize "stream"
        if (part.content == null) {
          this._part.content = this._createFileWritableStream(
            this._part as TPartFile,
            {}
          );
        }

        part.size += content.length;

        const constraints = this.options.fileSchema![fieldName];
        if (typeof constraints !== "boolean") {
          const constraintError = this._checkFileConstraints(constraints);
          if (constraintError != null) {
            part.error = constraintError;
            return;
          }
        }

        // When "createFileWritableStream" returns a string we shall append the file content to it
        if (typeof part.content == "string") {
          this.#logger.warn(
            'File "output" is a string, appending content to it! Note that the entirity of the file will be loaded into memory!'
          );
          this._part.content += content.toString();
          return;
        }

        part.content!.write(content);
        return;
      }

      case "field": {
        if (this.options.bodySchema == null) {
          this.#logger.debug(
            `No body schema was set for the parser! Field content will be ignored`
          );
          return;
        }

        const isFieldPresentInSchema = fieldName in this.options.bodySchema;
        if (!isFieldPresentInSchema) {
          this.#logger.debug(
            `No body schema was set for the parser! Field content will be ignored`
          );
          return;
        }

        // initialize the field content as an empty string
        if (this._part.content == null) {
          this._part.content = "";
        }

        this._part.content += content.toString().trim();
        this._part.size = (this._part.content as string).length;

        return;
      }
      case null:
        this.#logger.debug(
          `Probably a bug! We tried to append a content to a undetermined "type" of part, shoudl be "field" or "file"`
        );
        return;
    }
  }

  private _checkFileConstraints(constraint: TFileFieldOption) {
    const name = this._part.name ?? "unknown field name";
    const size = this._part.size;

    // check file "limits"
    if (constraint.maxFileSize != null && constraint.maxFileSize < size) {
      return new BadRequest(
        `Content size of file "${this._part
          .originalFilename!}" exceeds the max allowed file syze of ${
          constraint.maxFileSize
        } bytes`
      );
    }

    // check allowed mimes
    if (
      constraint.allowedMimeTypes != null &&
      !constraint.allowedMimeTypes.includes(this._part.contentType)
    ) {
      return new UnsupportedMediaType(
        `Content type of file "${this._part.originalFilename}" (${
          this._part.contentType
        }) is not supported by this endpoint! Acceptable media types: ${
          typeof constraint.allowedMimeTypes === "string"
            ? constraint.allowedMimeTypes
            : constraint.allowedMimeTypes.join(", ")
        }`
      );
    }

    if (constraint.multiple === false && this._processedParts[name!] != null) {
      this.#logger.debug(
        "Constrains of current part:",
        constraint,
        this._part.name
      );
      return new BadRequest(
        `File field "${name!}" is not set to allow multiple files!`
      );
    }

    if (constraint.multiple === true) {
      // max number of files
      if (
        constraint.max != null &&
        this._processedParts[name] != null &&
        this._processedParts[name].count >= constraint.max
      ) {
        return new BadRequest(
          `File field "${name}" only allows up to ${constraint.max} files!`
        );
      }

      // max size allowed
    }
  }

  private _endPart() {
    // end the writable stream
    if (this._part.content instanceof Writable) {
      this._part.content.end();

      if (this._part.error != null && this._part.filepath != null) {
        rm(this._part.filepath, (err) => {
          if (err != null) {
            this.#logger.warn(
              `Failed to remove file uploaded and parsed by Multipart, the request to download was issued due to an error being raised while it was being processed!\nError that prevented the parser to proceed: ${
                this._part.error!.message
              }\nError while deleting the temp file: [${err.code ?? "ERR"}] ${
                err.message
              }`
            );
          }
        });
      }
    }

    // notify the error, if present
    if (this._part.error != null) {
      this.emit("error", this._part.error, { ...this._part });
      return;
    }

    if (this._isPartOnSchema(this._part)) {
      // update processed parts metadata
      if (this._processedParts[this._part.name!] == null) {
        this._processedParts[this._part.name!] = {
          type: this._part.type as "field" | "file",
          aggregateSize: 0,
          count: 0,
        };
      }
      this._processedParts[this._part.name!].aggregateSize += this._part.size;
      this._processedParts[this._part.name!].count++;

      // send part
      this.push(this._part);
    }
  }

  private _isPartOnSchema(part: TBodyParserPartAny) {
    const typeOfPart = part.type;
    const partName = part.name;

    if (typeOfPart == null || partName == null) {
      return false;
    }

    if (typeOfPart === "field") {
      return (
        this.options.bodySchema != null && partName in this.options.bodySchema
      );
    }

    if (typeOfPart === "file") {
      return (
        this.options.fileSchema != null && partName in this.options.fileSchema
      );
    }

    return false;
  }

  private _checkTypeOfPartContent() {
    if (this._part.filename != null) {
      this._part.type = "file";
      // when sending a file where no "content-type" was sent use octet-stream as default
      if (this._part.contentType === "text/plain") {
        this._part.contentType = "application/octet-stream";
      }
    }

    if (this._part.contentType.startsWith("text/")) {
      this._part.type = "field";
      return;
    }

    this._part.type = "file";
  }

  private _createFileWritableStream(
    info: TPartFile,
    options?: TCreateFileStreamOptions
  ): Writable {
    throw new Error(
      "NOOP, a create file stream should be specified in the constructor, this is probably a bug! Theres a default function assigned while conistructing this object!"
    );
  }

  override _flush(callback: TransformCallback): void {
    //@ts-ignore flushing comes just before stream end, we wont be parsing anything anymore
    delete this._part;
    delete this._partHeaderLineBuffer;
    console.log(
      "Delta:",
      performance.now() - this._start,
      "\nBytes received:",
      this.bytesReceived
    );
    callback(null);
  }
}

type TProcessedPartInfo = {
  type: "file" | "field";
  count: number;
  aggregateSize: number;
};

let s = 0;
const ScannerState = {
  NOT_SET: s++,
  CHECK_PART_HEADER_VALIDITY: s++,
  LOOKUP_NAME_OF_PART: s++,
  ACQUIRE_PART_NAME: s++,
  CHECK_FOR_FILENAME_OR_END_OF_HEADER: s++,
  ACQUIRE_PART_FILENAME: s++,
  CHECK_FOR_OTHER_PART_HEADERS: s++,
  ACQUIRE_PART_CONTENT: s++,
  CHECK_FOR_END_OF_STREAM: s++,
  END_OF_STREAM: s++,
};

type TMultipartScannerState = (typeof ScannerState)[keyof typeof ScannerState];

const DELIMITER_START = Buffer.from("--");
const CRLF = Buffer.from("\r\n");

const HEADER_CONTENT_DISPOSITION = Buffer.from(
  "Content-Disposition: form-data;"
);
const HEADER_CONTENT_DISPOSITION_LOWER = Buffer.from(
  "content-disposition: form-data;"
);
const HEADER_CONTENT_TYPE = "content-type:";
const HEADER_PART_NAME = Buffer.from('name="');
const HEADER_FILENAME = Buffer.from('filename="');

const WHITE_SPACE = 32;
const DOUBLE_QUOTE = 34;
const CARRIAGE_RETURN = 13;
const NEW_LINE = 10;

export interface TMultipartParserOptions extends TBodyParserOptions {
  boundary: string;
  createFileWritableStream?: (info: TPartFile) => Writable;
  uploadDirectory?: string;
  preservePath?: string;
  logger?: TLogger;
}

const idGenerator = customAlphabet(urlAlphabet, 21);

export function DefaultCreateFileWritableStream(
  info: TPartFile,
  options?: TCreateFileStreamOptions
): Writable {
  // 1. check for upload drectory
  let uploadDirectory = options?.uploadDirectory ?? tmpdir();

  // TODO: get project root path to join with relative uploadDirectory, for now using cwd
  if (!uploadDirectory.startsWith("/")) {
    uploadDirectory = join(process.cwd(), uploadDirectory);
  }

  // option to preserve file path (??)
  if (options?.preservePath === true) {
    let pathFromFilename = dirname(info.filename ?? "");
    if (pathFromFilename.length > 0)
      uploadDirectory = join(uploadDirectory, pathFromFilename);
  }

  // create target directory if non-existant
  try {
    if (!existsSync(uploadDirectory)) {
      mkdirSync(uploadDirectory, { recursive: true });
    }
  } catch (err) {
    console.error(
      "Failed to create necessary file directories that shall hold the uploaded files!",
      err
    );
    throw err;
  }

  // create a new filename
  const now = new Date();
  let filename = `${now.getUTCFullYear().toString()}_${now
    .getUTCMonth()
    .toString()
    .padStart(2, "0")}_${now.getUTCDate().toString().padStart(2, "0")}_${now
    .getUTCHours()
    .toString()
    .padStart(2, "0")}_${now
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}_${now.getUTCSeconds()}_${idGenerator()}`;

  try {
    info.filename = filename;
    info.filepath = join(uploadDirectory, filename);

    const stream = createWriteStream(info.filepath, {});
    info.content = stream;
    return stream;
  } catch (err) {
    console.error(
      "Failed to create write stream to file: " + info.filepath,
      err
    );
    throw err;
  }
}

export interface TCreateFileStreamOptions {
  uploadDirectory?: string;
  preservePath?: boolean;
}

type TPartFile = Omit<TBodyParserPartFile, "content"> & { content: Writable };
