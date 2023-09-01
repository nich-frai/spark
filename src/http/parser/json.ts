import { Transform, type TransformCallback } from "node:stream";

export class JSONParser extends Transform {
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
    try {
      const fields = JSON.parse(
        Buffer.concat(this.chunks!).toString()
      );
      delete fields.__proto__
      this.push(fields);
    } catch (e: unknown) {
      if (e instanceof Error) callback(e);
      else callback(new Error(String(e)));
      return;
    }
    delete this.chunks;
    callback();
  }
}