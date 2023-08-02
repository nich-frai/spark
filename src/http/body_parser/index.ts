import { JSONParser } from "./json";
import { MultipartParser } from "./multipart";
import { TextPlainParser } from "./text_plain";
import { URLEncodedParser } from "./url_encoded";

export const BodyParser = {
  "application/json": JSONParser,
  "application/x-www-form-urlencoded": URLEncodedParser,
  "multipart/form-data": MultipartParser,
  "text/plain" : TextPlainParser
};
