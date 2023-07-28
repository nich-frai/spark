import type { IncomingMessage, ServerResponse } from "node:http";
import type { HTTPRoute } from "./route";
import type { AwilixContainer } from "awilix";

export class HTTPHandler {
  constructor(private container: AwilixContainer, private route: HTTPRoute) {}
  
  assembleHandlerFunction() {
    return function (req: IncomingMessage, res: ServerResponse) {};
  }
}
