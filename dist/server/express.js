"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const plugin_manager_js_1 = require("../plugin-manager.js");
async function createWrappedServer(config) {
  const app = createServer();
  const server = http_1.default.createServer(app);
  if (Object.keys(config.plugins).length) {
    const io = new socket_io_1.Server(server);
    // when there is a connection from new user socket
    io.on("connection", (socket) => {
      const id = socket.id;
      // wait for handshake events
      socket.on(config.join, (topic) => {
        const joinEvent = { event: config.join, id, data: topic };
        const plugin = (0, plugin_manager_js_1.getPlugin)(config, topic);
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
            const leaveEvent = {
              event: config.leave,
              id,
              data: topic,
            };
            if (config.debug) {
              console.info(leaveEvent);
            }
            // handle leave event in plugins
            const plugin = (0, plugin_manager_js_1.getPlugin)(config, topic);
            plugin?.call(io, socket, leaveEvent);
          });
        }
      });
    });
  }
  // WSGet compatible, this = method: string
  function createReader(path, wsGet) {
    const action = app[this.toLowerCase()];
    if (action) {
      action.call(app, path, (req, res, next) => wsGet(res, req, next));
    }
  }
  return {
    async listen(port) {
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
exports.default = createWrappedServer;
function createServer() {
  return (0, express_1.default)();
}
