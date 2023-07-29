import type { AwilixContainer } from "awilix";
import type { HTTPRoute } from "./route";
import { IncomingMessage, ServerResponse } from "node:http";

export class HTTPHandler {
    
    static fromRoute(route : HTTPRoute, container : AwilixContainer) {
        const handler = new HTTPHandler;


        return handler;
    }

    handle(req : IncomingMessage, res : ServerResponse) {
        
    }
}