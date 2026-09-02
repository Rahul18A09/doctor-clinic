import cors from "cors";
import express, { type ErrorRequestHandler, type Express, type NextFunction, type Request, type Response } from "express";

import { env } from "./config/env";
import authRouter from "./routes/auth.routes";
import doctorPatientsRouter, { doctorStatsRouter } from "./routes/doctor.routes";
import docsRouter from "./routes/docs.routes";
import healthRouter from "./routes/health.routes";
import notificationsRouter from "./routes/notifications.routes";
import patientRouter from "./routes/patients.routes";
import queueRouter from "./routes/queue.routes";
import receptionistRouter from "./routes/receptionists.routes";
import reportsRouter from "./routes/reports.routes";
import roomsRouter from "./routes/rooms.routes";
import bedsRouter from "./routes/beds.routes";
import settingsRouter from "./routes/settings.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("etag", false);
  app.use("/api/v1", (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  });
  app.use(
    cors({
      origin: [...env.corsAllowedOrigins],
      credentials: true,
      methods: ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
      allowedHeaders: [
        "accept",
        "accept-encoding",
        "authorization",
        "cache-control",
        "content-type",
        "dnt",
        "origin",
        "pragma",
        "user-agent",
        "x-csrftoken",
        "x-requested-with",
      ],
    }),
  );
  app.use(
    express.json({
      type: (req) => {
        const method = (req.method ?? "GET").toUpperCase();
        if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
          return false;
        }
        return Boolean(req.headers["content-type"]?.includes("application/json"));
      },
    }),
  );
  app.use(((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({
        detail: `JSON parse error - ${err.message}`,
      });
      return;
    }
    next(err);
  }) as ErrorRequestHandler);

  app.use("/api/docs", docsRouter);
  app.use("/api/docs/", docsRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/health/", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/auth/", authRouter);
  app.use("/api/v1/receptionists", receptionistRouter);
  app.use("/api/v1/receptionists/", receptionistRouter);
  app.use("/api/v1/settings", settingsRouter);
  app.use("/api/v1/settings/", settingsRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/reports/", reportsRouter);
  app.use("/api/v1/patients", patientRouter);
  app.use("/api/v1/patients/", patientRouter);
  app.use("/api/v1/queue", queueRouter);
  app.use("/api/v1/queue/", queueRouter);
  app.use("/api/v1/doctor/stats", doctorStatsRouter);
  app.use("/api/v1/doctor/stats/", doctorStatsRouter);
  app.use("/api/v1/doctor/patients", doctorPatientsRouter);
  app.use("/api/v1/doctor/patients/", doctorPatientsRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/notifications/", notificationsRouter);
  app.use("/api/v1/rooms", roomsRouter);
  app.use("/api/v1/rooms/", roomsRouter);
  app.use("/api/v1/beds", bedsRouter);
  app.use("/api/v1/beds/", bedsRouter);

  return app;
}

const app = createApp();

export default app;
