import http from "http";
import express from "express";
import { Socket } from "socket.io";
import { getPlugin } from "../plugin-manager.js";
import { WSEvent, WSGet, WSPlugin, WSServer } from "../types.js";
import config from "../config.js";

export default async function createWrappedServer(): Promise<WSServer> {
  const app: any = createServer();
  const server = http.createServer(app);

  if (Object.keys(config.plugins).length) {
    const { Server } = await import("socket.io");
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
  function createReader(path: string, wsGet: WSGet): void {
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
    get: createReader.bind("GET"),
    post: createReader.bind("POST"),
    any: createReader.bind("ANY"),
  };
}

function createServer(): any {
  return express();
}
