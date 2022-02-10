"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = __importDefault(require("../cache"));
const express_1 = __importDefault(require("./express"));
const static_files_js_1 = __importDefault(require("./static-files.js"));
const config_js_1 = __importDefault(require("../config.js"));
async function startServer(userConfig = {}) {
  const config = { ...config_js_1.default, ...userConfig };
  // create the express or uws server inside a wrapper
  const server = await (0, express_1.default)();
  // create the static files reader based on folder
  const fileReader = (0, static_files_js_1.default)(config.folder);
  // and create a cache for above
  const fileReaderCache = new cache_1.default(fileReader);
  // everything goes to the reader
  server.get("/*", (res, req, next) => {
    const url = getUrl(req.originalUrl);
    const { status, mime, body } = fileReaderCache.get(url);
    if (config.debug) {
      console.info(status, mime, url);
    }
    // header sets content type
    res.header("Content-Type", mime);
    // write header sets status
    res.writeHeader(status);
    res.end(body);
  });
  // finally start the server on process.env.PORT || 4200
  await server.listen(config.port);
  return server;
}
exports.default = startServer;
function getUrl(url) {
  return decodeURIComponent(
    url.replace(/^\/+/, "").split("?")[0].split("#")[0]
  );
}
