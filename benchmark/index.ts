import { MultipartParser } from "#http/parser/multipart.js";
import { PinoLogger } from "#logger";
import { createContainer } from "awilix";
import { inspect } from "util";

const customBoundary =
  "-----------------------------168072sdfs82475249we41622650073";

const parser = new MultipartParser(createContainer(), {
  boundary: customBoundary,
  allowedContentTypes: ["multipart/form-data"],
  maxBodySize: 1024 * 1024 * 1024 * 20,
  fileSchema: {
    a: true,
  },
});

PinoLogger.enableDevOutput();

const buf = createMultipartBody({
  numberOfParts: 4,
  sizeOfFile: 256 * 1024 * 1024,
});

const start = performance.now();

parser.on('data', (data) => {
  console.log('Data', data.size);
});

parser.on('error', (err) => {
  console.log(err)
})

parser.write(buf, (e) => {
  if (e != null) {
    process.stdout.write(`Error! ${inspect(e)}`);
    process.exit(1);
  }
  process.stdout.write(
    `Took ${performance.now() - start} ms to process ${buf.length} bytes`
  );
  process.exit(0);
});

function createMultipartBody(options: TTestMultipartOptions) {
  const body = Buffer.concat([
    Buffer.from(`--${customBoundary}\r\n`),
    ...Array.from({ length: options.numberOfParts }).map((_v, i) => {
      const partHeader = Buffer.from(
        `content-disposition: form-data; name="a";filename="a.test"\r\ncontent-type: image/jpg\r\n\r\n`
      );

      const partBody = Buffer.alloc(options.sizeOfFile, 0);

      return Buffer.concat([
        partHeader,
        partBody,
        Buffer.from(`\r\n--${customBoundary}`),
      ]);
    }),
    Buffer.from(`--\r\n`),
  ]);

  return body;
}

interface TTestMultipartOptions {
  numberOfParts: number;
  sizeOfFile: number;
}
