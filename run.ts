import { route } from "#http";
import { t } from "src/typebox";
import { Server } from "#http/server";
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
    async handler(req) {
      return `hello ${req.body.a ?? "World"}!`;
    }
  })
);

server
  .listen(4001)
  .then((o) => server.logger.info("Server started listening!", o));
