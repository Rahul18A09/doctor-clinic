import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import type { NextFunction, Request, Response } from "express";

import { requestLogger } from "../../src/middleware/requestLogger";

function mockReq(partial: Partial<Request>): Request {
  return {
    method: "GET",
    originalUrl: "/api/v1/patients",
    url: "/api/v1/patients",
    path: "/api/v1/patients",
    ...partial,
  } as Request;
}

function mockRes(statusCode = 200): Response & EventEmitter {
  const res = new EventEmitter() as Response & EventEmitter;
  (res as Response).statusCode = statusCode;
  return res;
}

describe("requestLogger", () => {
  it("logs method, path, status, and duration after response finishes", async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    try {
      const req = mockReq({
        method: "GET",
        originalUrl: "/api/v1/patients?search=secret-name",
      });
      const res = mockRes(200);
      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      requestLogger(req, res as Response, next);
      assert.equal(nextCalled, true);

      await new Promise((resolve) => setTimeout(resolve, 5));
      res.emit("finish");

      assert.equal(lines.length, 1);
      const line = lines[0];
      assert.match(line, /^\[API\] \d{4}-\d{2}-\d{2}T/);
      assert.match(line, / GET \/api\/v1\/patients → 200 \(\d+ms\)$/);
      assert.doesNotMatch(line, /secret-name/);
      assert.doesNotMatch(line, /Authorization|password|cookie/i);
    } finally {
      console.log = originalLog;
    }
  });

  it("logs error status codes", () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    try {
      const req = mockReq({ method: "POST", originalUrl: "/api/v1/patients" });
      const res = mockRes(401);
      requestLogger(req, res as Response, () => undefined);
      res.emit("finish");

      assert.equal(lines.length, 1);
      assert.match(lines[0], / POST \/api\/v1\/patients → 401 \(\d+ms\)$/);
    } finally {
      console.log = originalLog;
    }
  });
});
