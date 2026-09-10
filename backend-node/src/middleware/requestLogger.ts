import type { NextFunction, Request, RequestHandler, Response } from "express";

function requestPath(req: Request): string {
  // Prefer path without query string to avoid logging search/filter PII.
  const raw = req.originalUrl || req.url || req.path || "/";
  const pathOnly = raw.split("?")[0] || "/";
  return pathOnly.length > 0 ? pathOnly : "/";
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Centralized HTTP request logger.
 * Logs method, path, status, and duration only — never bodies, headers, or tokens.
 */
export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();
  const method = (req.method || "GET").toUpperCase();
  const path = requestPath(req);

  res.on("finish", () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNs) / 1_000_000;
    const status = res.statusCode;
    const timestamp = formatTimestamp(new Date());
    console.log(
      `[API] ${timestamp} ${method} ${path} → ${status} (${durationMs.toFixed(0)}ms)`,
    );
  });

  next();
};
