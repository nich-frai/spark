import type { HTTPVersion, Req } from 'find-my-way';

export async function JSONParser(stream : Req<HTTPVersion>) {
    let body : Uint8Array[] = [];

    for await (let chunk of stream) {
        body.push(chunk);
    }

    const json = JSON.parse(Buffer.concat(body).toString("utf-8"));
    delete json.__proto__
    return json;
}