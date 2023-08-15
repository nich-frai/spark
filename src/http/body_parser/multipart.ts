import { BadRequest } from "#http/http_error";
import { PinoLogger } from "#logger";
import { Transform, Writable, type TransformCallback } from "node:stream";
import type { TFileRestriction } from "..";

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

const ScannerStateNames = Object.entries(ScannerState).reduce<
  Record<number, string>
>((o, [name, value]) => {
  o[value] = name;
  return o;
}, {});

type TMultipartScannerState = (typeof ScannerState)[keyof typeof ScannerState];

const DELIMITER_START = Buffer.from("--");
const CRLF = Buffer.from("\r\n");

const HEADER_CONTENT_DISPOSITION = Buffer.from(
  "Content-Disposition: form-data;"
);
const HEADER_CONTENT_DISPOSITION_LOWER = Buffer.from(
  "content-disposition: form-data;"
);
const HEADER_CONTENT_TYPE = 'content-type:'
const HEADER_PART_NAME = Buffer.from('name="');
const HEADER_FILENAME = Buffer.from('filename="');

const WHITE_SPACE = 32;
const DOUBLE_QUOTE = 34;
const CARRIAGE_RETURN = 13;
const NEW_LINE = 10;

export class MultipartParser extends Transform {
  #logger = new PinoLogger({ name: "MultipartParser" });

  static DefaultCreateFileWritableStream = DefaultCreateFileWritableStream

  private _contentDispositionLookupIndex = 0;
  private _partNameLookupIndex = 0;
  private _filenameLookupIndex = 0;
  private _boundaryContentPartLookupIndex = 0;
  private _endOfStreamLookupIndex = 0;
  private _newPartLookupIndex = 0;
  private _delimiterLookupIndex = 0;

  private _partHeaderLineBuffer?: Buffer;
  private _partName = "";
  private _partFilename = "";
  private _partInfo: TFormDataPartInfo = {
    contentType: "text/plain",
  };

  private state: TMultipartScannerState = ScannerState.NOT_SET;
  private boundaryDelimiter: Buffer;

  constructor(private options : TMultipartParserOptions) {
    super({ readableObjectMode: true });
    this.boundaryDelimiter = Buffer.concat([
      DELIMITER_START,
      Buffer.from(options.boundary),
    ]);

    this._createFileWritableStream = options.createFileWritableStream ?? MultipartParser.DefaultCreateFileWritableStream
  }

  setState(state: TMultipartScannerState) {
    // this.#logger.debug(
    //   `${ScannerStateNames[this.state]} -> ${ScannerStateNames[state]}`
    // );
    this.state = state;

    if (state === ScannerState.CHECK_PART_HEADER_VALIDITY) {
      this._partInfo = { contentType : 'text/plain'}
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
      this._boundaryContentPartLookupIndex = 0;
    }

    if (state == ScannerState.CHECK_FOR_END_OF_STREAM) {
      this._endOfStreamLookupIndex = 0;
      this._newPartLookupIndex = 0;
      this._delimiterLookupIndex = 0;
    }
  }

  override _transform(
    chunk: Buffer,
    encoding: BufferEncoding | "buffer",
    callback: TransformCallback
  ): void {
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
      this.#logger.debug(`Found boundary at ${startAt}!`);
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
          this._partInfo.name = this._partName;
          this.#logger.debug(`Part name acquired: "${this._partName}"`);
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
          this._partInfo.filename = this._partFilename;
          this._partInfo.originalFilename = this._partFilename;
          this.#logger.debug(`Part filename acquired: "${this._partFilename}"`);
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
            this.#logger.debug(
              `Found a complete header line: "${lineContent
                .toString()
                .replaceAll("\n", "\n/n")
                .replaceAll("\r", "/r")}"`
            );
            lastLinePosition = b + 2;
            continue;
          }
        }

        // we have not reached the header end and exhausted the chunk length, add everything to the "line buffer" and wait for the next iteration
        if (this.state === ScannerState.CHECK_FOR_OTHER_PART_HEADERS) {
          this._partHeaderLineBuffer = chunk.subarray(a);
          this.#logger.debug(
            "Have not reached EOL: ",
            this._partHeaderLineBuffer.toString().replaceAll("\r\n", "/rn")
          );
          break;
        }
      }

      // 7th task pump data until the boundary is found
      if (this.state === ScannerState.ACQUIRE_PART_CONTENT) {
        // iterate until boundary
        for (let b = a; b < chunk.length; b++) {
          // If it matches the boundary, add to the index
          if (
            chunk[b] ===
            this.boundaryDelimiter[this._boundaryContentPartLookupIndex]
          ) {
            this._boundaryContentPartLookupIndex++;
          } else {
            this._boundaryContentPartLookupIndex = 0;
          }

          // We reached the end of the comparison fullly matching a boundary! pump the part info and check for more
          if (
            this._boundaryContentPartLookupIndex ===
            this.boundaryDelimiter.length
          ) {
            this._addToPartContent(
              chunk.subarray(a, b - this.boundaryDelimiter.length + 1)
            );
            this._endPart();
            this.setState(ScannerState.CHECK_FOR_END_OF_STREAM);
            a = b;
            break;
          }
        }

        // we have reached the end of the chunk and the boundary was not found, pump the current chunk to the part content
        if (this.state === ScannerState.ACQUIRE_PART_CONTENT) {
          this._addToPartContent(chunk.subarray(a));
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
    if(typeof header != "string") header = header.toString()
    header = header.toLocaleLowerCase().trim()

    // valid header: content-type!
    if(header.startsWith(HEADER_CONTENT_TYPE)) {
      
      if(header.indexOf(';') >= 0) {
        this._partInfo.contentType = header.substring(HEADER_CONTENT_TYPE.length -1,header.indexOf(';'))
        const charsetString = header.substring(header.indexOf(';'));
        if(charsetString.startsWith('charset=')) {
          this._partInfo.charset = charsetString.substring('charset='.length - 1)
        }
        this.#logger.debug(`Updating part content type AND charset based on header: ${this._partInfo.contentType} : ${this._partInfo.charset}`);
      } else {
        this._partInfo.contentType = header.substring('content-type:'.length -1)
        this.#logger.debug(`Updating part content type based on header: ${this._partInfo.contentType}`)
      }

      return;
    }

    // valid but deprecated header: content-transfer-encoding //TODO: ? should implement a deprecated feature ?
    if(header.startsWith('content-transfer-encoding:')) {
      this.#logger.warn('A valid, but deprecated, header "content-transfer-encoding" was found! Not implemented in this parser!');
      return;
    }

    // all other headers should be ignored
    this.#logger.debug(`Invalid/Unknown header while parsing multipart: "${header}", ignoring it!`);

  }

  private _addToPartContent(content: Buffer) {
    if (this._partInfo.type!  == 'file') {
      
      if(this._partInfo.content == null) {
        this._partInfo.content = this._createFileWritableStream(this._partInfo as TFilePartInfo)
      }

      if(typeof this._partInfo.content == "string") {
        this.#logger.warn('File "output" is a string, appending content to it! The entirity of the file will be loaded into memory!');
      // TODO: check and use charset if it's valid!
      if(this._partInfo.charset != null) {}
        this._partInfo.content += content.toString();
        return;
      }
      this._partInfo.content!.write(content);
      return;
    } else {
      if(this._partInfo.content == null) this._partInfo.content = ""
      if(this._partInfo.content instanceof Writable) {
        this.#logger.warn('Field "output" is a Writable stream, writing content to it! This is unusual and the parser should be aware of howe to handle filed values as streams!')
        this._partInfo.content.write(content);
        return;
      }
      // TODO: check and use charset if it's valid!
      if(this._partInfo.charset != null) {}
      this._partInfo.content += content.toString();
    }
  }

  private _endPart() {
    this.#logger.debug("End of part!", this._partInfo);
    this.push(this._partInfo);
  }

  private _checkTypeOfPartContent() {
    
    if(this._partInfo.filename != null) {
      this._partInfo.type = 'file';
      // when sending a file where no "contetn-type" was sent use octet-stream as default
      if(this._partInfo.contentType === 'text/plain') {
        this._partInfo.contentType = 'application/octet-stream'
      }
    }

    if(this._partInfo.contentType.startsWith('text/')) {
      this._partInfo.type = 'field'
    }

    this._partInfo.type = 'file'

  }

  private _createFileWritableStream(info : TFilePartInfo) : Writable {
    throw new Error('NOOP, a create file stream should be specified in the constructor, this is probably a bug! Theres a default function assigned while conistructing this object!');
  }

  override _flush(callback: TransformCallback): void {
    this.#logger.debug("Multipart flush stream: ");
    callback(null, { a: "" });

    //super._flush(callback);
  }

  override _destroy(
    error: Error | null,
    callback: (error: Error | null) => void
  ): void {
    this.#logger.debug("Multipart destroy stream: ", callback);
    super._destroy(error, callback);
  }
}

type TFormDataPartInfo = {
  type? : 'field' | 'file'
  name?: string;
  filename?: string;
  originalFilename? : string;
  contentType: string;
  charset?: string;
  content? : string | Writable;
};

export type TFilePartInfo = TFormDataPartInfo & {
  type: 'file';
  readonly originalFilename?: string;
};

export interface TMultipartParserOptions {
  boundary : string;

  maxTotalBodySize? : number;
  
  createFileWritableStream?: (info : TFilePartInfo) => Writable;

  schema? : TFileRestriction;

}

export function DefaultCreateFileWritableStream(info : TFilePartInfo) : Writable {


  throw new Error('Not implemented yet')
}