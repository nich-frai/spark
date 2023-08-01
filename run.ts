import { route } from "#http";
import { t } from "src/typebox";
import { Server } from "#http/server";
import type { TOptionalKeys } from "#http/schema";
import { PinoLogger } from "#logger";

PinoLogger.enableDevOutput();

const server = new Server();

server.addRoute(
  route({
    url: "/",
    method: "GET",
    queryString: {
      name: t.Optional(t.String()),
    },
    handler(req) {
      return `hello ${req.queryString().name ?? "World"}!`;
    },
  }),
  route({
    url : "/",
    method : 'post',
    handler(req) {
        
    }
  })
);

server
  .listen(4001)
  .then((o) => server.logger.info("Server started listening!", o));
