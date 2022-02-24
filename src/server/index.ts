import http, { RequestListener } from "http";
import https from "https";
import express, { Request, Response } from "express";
import Cache from "chef-core/dist/cache";
import { Socket, Server } from "socket.io";
import { getPlugin } from "chef-core/dist/plugins";
import { WSConfig, WSEvent, WSPlugin, WSServer } from "chef-core/dist/types";
import getUrl from "chef-core/dist/server/get-url";
import config from "chef-core/dist/config";
import { readFileSync } from "fs";

export async function createServer(config: WSConfig): Promise<WSServer> {
  const app: Express.Application = express();
  const server: http.Server | https.Server = createExpressServer(config, app);

  if (Object.keys(config.plugins).length) {
    const io = new Server(server);

    // when there is a connection from new user socket
    io.on("connection", (socket: Socket) => {
      const id: string = socket.id;

      // wait for handshake events
      socket.on(config.join, (topic: string) => {
        const joinEvent: WSEvent = { event: config.join, id, data: topic };
        const plugin: WSPlugin | undefined = getPlugin(config, topic);

        // check if we have such plugin
        if (plugin) {
          // socket joins room
          socket.join(topic);

          // notifies everybody
          io.to(topic).emit(joinEvent.event, joinEvent.id, topic);

          if (config.debug) {
            console.info(joinEvent);
          }

          // on all actions from socket, use plugin
          socket.onAny((event, data) => {
            if (config.debug) {
              console.info({ event, id, data });
            }

            // bind io to context for plugin to have access
            plugin?.call(io, socket, { event, id, data });
          });

          socket.on("disconnect", () => {
            socket.leave(topic);

            const leaveEvent: WSEvent = {
              event: config.leave,
              id,
              data: topic,
            };

            if (config.debug) {
              console.info(leaveEvent);
            }

            // handle leave event in plugins
            const plugin: WSPlugin | undefined = getPlugin(config, topic);

            plugin?.call(io, socket, leaveEvent);
          });
        }
      });
    });
  }

  (app as WSServer).start = function (port: number) {
    return new Promise((resolve) => {
      // ensure port is number
      server.listen(+port, () => resolve(app as WSServer));
    });
  };

  return app as WSServer;
}

function createExpressServer(
  config: WSConfig,
  app: Express.Application
): http.Server | https.Server {
  // spread ssl from config
  const { ssl } = config;

  // if config key and cert present
  if (ssl?.key && ssl?.cert) {
    const { key, cert } = ssl;

    // start ssl app and finish
    return https.createServer(
      { key: readFileSync(key), cert: readFileSync(cert) },
      app as RequestListener
    );
  }

  // else start normal app
  return http.createServer(app);
}

export function requestHandler(fileReaderCache: Cache) {
  return (req: Request, res: Response) => {
    const url: string = getUrl(req.originalUrl);
    const { status, mime, body } = fileReaderCache.get(url);

    if (config.debug) {
      console.info(status, mime, url);
    }

    // header sets content type
    res.header("Content-Type", mime);
    // write header sets status
    res.writeHead(status);

    res.end(body);
  };
}
