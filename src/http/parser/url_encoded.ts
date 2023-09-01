import { Transform } from "node:stream";
import type { TransformCallback } from "stream";
import type { TBodyParserOptions, TBodyParserPartField } from "./body_parser.js";
import { PayloadTooLarge } from "#http/http_error.js";
import type { AwilixContainer } from "awilix";
import { PinoLogger, type TLogger } from "#logger";

export class URLEncodedParser extends Transform {
  #logger: TLogger = new PinoLogger({ name: "URLEncodedParser" });

  private state: URLEncodedState[keyof URLEncodedState] =
    State.ACQUIRE_FIELD_NAME;

  private bytesReceived: number = 0;

  private nameLookupIndex = 0;
  private valueLookupIndex = 0;

  private fieldName = "";
  private fieldValue = "";

  constructor(
    private container: AwilixContainer,
    private options: TBodyParserOptions
  ) {
    super({
      readableObjectMode: true,
    });
  }

  private setState(state: URLEncodedState[keyof URLEncodedState]) {
    this.state = state;
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.bytesReceived += chunk.length;
    if (this.bytesReceived > this.options.maxBodySize) {
      callback(new PayloadTooLarge());
      return;
    }

    for (let a = 0; a < chunk.length; a++) {
      if (this.state === State.ACQUIRE_FIELD_NAME) {
        if (chunk[a] === EQUAL_SYMBOL) {
          this.fieldName += chunk
            .subarray(this.nameLookupIndex, a)
            .toString();

          // change to acquire field value
          this.valueLookupIndex = a + 1;
          this.setState(State.ACQUIRE_FIELD_VALUE);
        }
      }

      if (this.state === State.ACQUIRE_FIELD_VALUE) {
        if (chunk[a] === AMP_SYMBOL) {
          this.fieldValue += chunk
            .subarray(this.valueLookupIndex, a)
            .toString();

          this.setState(State.ACQUIRE_FIELD_NAME);
          this.nameLookupIndex = a + 1;

          this._sendFieldContent();
          this._resetKeyValuePair();
        }
      }
    }

    if (this.state === State.ACQUIRE_FIELD_NAME) {
      this.fieldName += chunk
        .subarray(this.nameLookupIndex, chunk.length - 1)
        .toString();
    }

    if (this.state === State.ACQUIRE_FIELD_NAME) {
      this.fieldValue += chunk
        .subarray(this.nameLookupIndex, chunk.length - 1)
        .toString();
    }

    this.nameLookupIndex = 0;
    this.valueLookupIndex = 0;

    callback();
  }

  override _flush(callback: TransformCallback): void {
    // call save value pair for "last key value pair" since there is no marking for "end of url encoded string"
    this._sendFieldContent();

    // send the body as the data
    callback(null);
  }

  private _sendFieldContent() {
    
    if (this.options.bodySchema == null) {
      this.#logger.debug('Body schema not set! Ignoring URL encoded content!');
      return;
    }

    // decode field name before checking if it exists in schema!
    this.fieldName = decodeURIComponent(this.fieldName.replaceAll('+', ' '))
    console.log(this.fieldName);

    if (!Object.keys(this.options.bodySchema).includes(this.fieldName)) {
      this.#logger.debug(`Body schema does not include field "${this.fieldName}"! Ingoring it`);
      return;
    }

    this.push({
      type: "field",
      name: this.fieldName,
      content: decodeURIComponent(this.fieldValue.replaceAll('+', ' ')),
      contentType : 'text/plain',
      size : this.fieldValue.length
    } satisfies TBodyParserPartField);
  }

  private _resetKeyValuePair() {
    this.fieldName = "";
    this.fieldValue = "";
  }
}

let s = 0;
const State = {
  ACQUIRE_FIELD_NAME: s++,
  ACQUIRE_FIELD_VALUE: s++,
};

const EQUAL_SYMBOL = "=".charCodeAt(0);
const AMP_SYMBOL = "&".charCodeAt(0);

type URLEncodedState = typeof State;
