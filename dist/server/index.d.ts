import { Request, Response } from "express";
import Cache from "chef-core/dist/cache";
import { WSConfig, WSServer } from "chef-core/dist/types";
export declare function createServer(config: WSConfig): Promise<WSServer>;
export declare function requestHandler(
  fileReaderCache: Cache
): (req: Request, res: Response) => void;
//# sourceMappingURL=index.d.ts.map
