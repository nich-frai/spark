import type { HTTPVersion, Req } from "find-my-way";

export async function TextPlainParser(stream: Req<HTTPVersion>) {
  let body: Uint8Array[] = [];

  for await (let chunk of stream) {
    console.log("Stream Chunk:", chunk);
    body.push(chunk);
  }

  return Buffer.concat(body).toString("utf-8");
}
