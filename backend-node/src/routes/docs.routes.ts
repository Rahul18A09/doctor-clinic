import { Router, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "../docs/openapi";

const docsRouter = Router();

docsRouter.get("/openapi.json", (_req: Request, res: Response): void => {
  res.status(200).json(openApiDocument);
});

docsRouter.use(
  "/",
  ...swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "Clinic API docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  }),
);

export default docsRouter;
