import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { successResponse } from "../http/responses";
import { getPublicQueueStatus } from "../patients/queue";

const getQueueStatus: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  successResponse(res, {
    message: "Queue status retrieved successfully.",
    data: await getPublicQueueStatus(),
  });
};

const queueRouter = Router();
queueRouter.get("/", getQueueStatus);

export default queueRouter;
