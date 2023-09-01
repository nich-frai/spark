import type { HTTPVersion, Req } from "find-my-way";
import { Transform, type TransformCallback } from "node:stream";

export class TextPlainParser extends Transform {
  private chunks?: Uint8Array[];
  constructor(options = {}) {
    super({ readableObjectMode: true });
    this.chunks = [];
  }

  override _transform(
    chunk: Uint8Array,
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    this.chunks!.push(chunk);
    callback();
  }

  override _flush(callback: TransformCallback) {
    const plainText = Buffer.concat(this.chunks!).toString()
    callback(null, plainText);
    return;
  }
}
