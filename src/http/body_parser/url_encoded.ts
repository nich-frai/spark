import type { HTTPVersion, Req } from "find-my-way";

export async function URLEncodedParser(req: Req<HTTPVersion>) {
  const bodyParts: Uint8Array[] = [];

  for await (let chunk of req) {
    bodyParts.push(chunk);
  }

  const bodyString = Buffer.concat(bodyParts).toString().replace('+', ' ');
  const body: Record<string, string | string[]> = Object.create(null);
  const pieces = bodyString.split("&");

  for (let piece of pieces) {
    // If bytes is the empty byte sequence, then continue.
    if (piece.length === 0) continue;

    let ioEqual = piece.indexOf("=");
    // If bytes contains a 0x3D (=), then let name be the bytes from the start of bytes up to but excluding its first 0x3D (=), and let value be the bytes, if any, after the first 0x3D (=) up to the end of bytes. 
    // If 0x3D (=) is the first byte, then name will be the empty byte sequence. If it is the last, then value will be the empty byte sequence.
    if(ioEqual >= 0) {
        const keyName = piece.substring(0, ioEqual)
        const value = ioEqual === piece.length - 1 ? "" : piece.substring(ioEqual + 1)
        // key previously set
        if(body[keyName] != null) {
          // not an array!
          if(!Array.isArray(body[keyName])) {
            body[keyName] = [ body[keyName] as string]
          }
          (body[keyName] as string[]).push(value)
        } else {
          body[keyName] = value
        }
        continue;
    }
    
    if (ioEqual < 0) {
      body[piece] = "";
    }
  }

  delete body.__proto__

  return body;
}
