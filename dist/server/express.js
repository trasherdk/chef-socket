"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k];
          },
        });
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const plugin_manager_js_1 = require("../plugin-manager.js");
const config_js_1 = __importDefault(require("../config.js"));
async function createWrappedServer() {
  const app = createServer();
  const server = http_1.default.createServer(app);
  if (Object.keys(config_js_1.default.plugins).length) {
    const { Server } = await Promise.resolve().then(() =>
      __importStar(require("socket.io"))
    );
    const io = new Server(server);
    // when there is a connection from new user socket
    io.on("connection", (socket) => {
      const id = socket.id;
      // wait for handshake events
      socket.on(config_js_1.default.join, (topic) => {
        const joinEvent = { event: config_js_1.default.join, id, data: topic };
        const plugin = (0, plugin_manager_js_1.getPlugin)(
          config_js_1.default,
          topic
        );
        // check if we have such plugin
        if (plugin) {
          // socket joins room
          socket.join(topic);
          // notifies everybody
          io.to(topic).emit(joinEvent.event, joinEvent.id, topic);
          if (config_js_1.default.debug) {
            console.info(joinEvent);
          }
          // on all actions from socket, use plugin
          socket.onAny((event, data) => {
            if (config_js_1.default.debug) {
              console.info({ event, id, data });
            }
            // bind io to context for plugin to have access
            plugin?.call(io, socket, { event, id, data });
          });
          socket.on("disconnect", () => {
            socket.leave(topic);
            const leaveEvent = {
              event: config_js_1.default.leave,
              id,
              data: topic,
            };
            if (config_js_1.default.debug) {
              console.info(leaveEvent);
            }
            // handle leave event in plugins
            const plugin = (0, plugin_manager_js_1.getPlugin)(
              config_js_1.default,
              topic
            );
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
