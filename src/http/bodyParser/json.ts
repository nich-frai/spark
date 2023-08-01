import type { HTTPVersion, Req } from 'find-my-way';
import { inspect } from 'node:util';

export async function JSONParser(stream : Req<HTTPVersion>) {
    let body : Uint8Array[] = [];

    for await (let chunk of stream) {
        console.log('Stream Chunk:', chunk);
        inspect(chunk);
        body.push(chunk);
    }

    return JSON.parse(Buffer.concat(body).toString("utf-8"));
}