import { Router, type Request, type Response } from "express";

import { pingDatabase } from "../config/database";

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const connected = await pingDatabase();
  res.status(200).json({
    status: "ok",
    database: connected ? "connected" : "disconnected",
  });
}

const healthRouter = Router();
healthRouter.get("/", healthHandler);

export default healthRouter;
