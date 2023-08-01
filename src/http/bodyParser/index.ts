import { JSONParser } from "./json";
import { MultipartParser } from "./multipart";
import { URLEncodedParser } from "./urlEncoded";

export const BodyParser = {
  "application/json": JSONParser,
  "application/x-www-form-urlencoded": URLEncodedParser,
  "multipart/form-data": MultipartParser,
};
