import http from "http";
import https from "https";
import express from "express";
import Cache from "chef-core/dist/cache";
import { Socket, Server } from "socket.io";
import { getPlugin } from "chef-core/dist/plugins";
import {
  WSConfig,
  WSEvent,
  WSGet,
  WSPlugin,
  WSServer,
} from "chef-core/dist/types";
import getUrl from "chef-core/dist/server/get-url";
import config from "chef-core/dist/config";
import { readFileSync } from "fs";

export async function createServer(config: WSConfig): Promise<WSServer> {
  const app: any = express();
  const server: any = createExpressServer(config, app);

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

  // WSGet compatible, this = method: string
  function expressReader(path: string, wsGet: WSGet): void {
    const action = app[this.toLowerCase()];

    if (action) {
      action.call(
        app,
        path,
        (req: Express.Request, res: Express.Response, next: any) =>
          wsGet(res, req, next)
      );
    }
  }

  return {
    async listen(port: number): Promise<any> {
      return new Promise((resolve) => {
        // ensure port is number
        server.listen(+port, () => resolve(server));
      });
    },
    get: expressReader.bind("GET"),
    post: expressReader.bind("POST"),
    any: expressReader.bind("ANY"),
  };
}

function createExpressServer(config: WSConfig, app: any): any {
  // spread ssl from config
  const { ssl } = config;

  // if config key and cert present
  if (ssl?.key && ssl?.cert) {
    const { key, cert } = ssl;

    // start ssl app and finish
    return https.createServer(
      { key: readFileSync(key), cert: readFileSync(cert) },
      app
    );
  }

  // else start normal app
  return http.createServer(app);
}

export function requestHandler(fileReaderCache: Cache) {
  return (res: any, req: any) => {
    const url: string = getUrl(req.originalUrl);
    const { status, mime, body } = fileReaderCache.get(url);

    if (config.debug) {
      console.info(status, mime, url);
    }

    // header sets content type
    res.header("Content-Type", mime);
    // write header sets status
    res.writeHeader(status);

    res.end(body);
  };
}
