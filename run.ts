import { route } from "#http";
import { t } from "./src/typebox/index.js";
import { Server } from "#http/server.js";
import { PinoLogger } from "#logger";

PinoLogger.enableDevOutput();

const server = new Server();

server.addRoute(
  route({
    url: "/",
    method: "GET",
   
    async handler(req) {
    },
  }),
  route({
    url : "/",
    method : 'POST',
    body: {
      a: t.Optional(t.String()),
    },
    file : {
      'b' : {
        multiple :  false,
        maxFileSize: 1024 * 100       
      }
    },
    async handler(req) {
      return `hello ${req.body.a ?? "World"}!`;
    }
  }),
  route({
    url : "/urlencoded",
    method : 'POST',
    body: {
      'a b#': t.Optional(t.String()),
    },
    async handler(req) {
      return `hello ${req.body['a b#'] ?? "World"}!`;
    }
  })
);

server
  .listen(4001)
  .then((o) => server.logger.info("Server started listening!", o));
