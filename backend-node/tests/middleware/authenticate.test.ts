import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextFunction, Request, Response } from "express";

import { generateAccessToken, generateRefreshToken } from "../../src/auth/jwt";
import type { AuthenticatedUser } from "../../src/auth/types";
import { createAuthenticateMiddleware } from "../../src/middleware/authenticate";

const DB_USER: AuthenticatedUser = {
  id: "6a72b26dedcd1f8304e2f138",
  full_name: "System Administrator",
  email: "admin@example.com",
  role: "RECEPTIONIST",
  is_active: true,
  is_deleted: false,
};

function mockResponse(): Response & { statusCode: number; body: unknown; headers: Record<string, string> } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

function mockRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) {
    headers.authorization = authorization;
  }
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

async function runMiddleware(
  middleware: ReturnType<typeof createAuthenticateMiddleware>,
  req: Request,
): Promise<{ res: ReturnType<typeof mockResponse>; nextCalled: boolean }> {
  const res = mockResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  await middleware(req, res, next);
  return { res, nextCalled };
}

describe("authenticate middleware", () => {
  process.env["SECRET_KEY"] = "jwt-unit-test-secret";
  process.env["JWT_SECRET"] = "";

  const loadUser = async (userId: string): Promise<AuthenticatedUser | null> => {
    if (userId !== DB_USER.id) {
      return null;
    }
    return { ...DB_USER };
  };

  const authenticate = createAuthenticateMiddleware({ loadUser });

  it("rejects a missing Authorization header", async () => {
    const { res, nextCalled } = await runMiddleware(authenticate, mockRequest());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "Authentication credentials were not provided." });
  });

  it("requires a Bearer token", async () => {
    const { res, nextCalled } = await runMiddleware(
      authenticate,
      mockRequest("Token abc"),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "Authentication credentials were not provided." });
  });

  it("rejects an invalid access token", async () => {
    const { res, nextCalled } = await runMiddleware(
      authenticate,
      mockRequest("Bearer not-a-jwt"),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "Token is invalid or expired." });
  });

  it("rejects a refresh token", async () => {
    const refresh = generateRefreshToken({
      user_id: DB_USER.id,
      email: DB_USER.email,
      full_name: DB_USER.full_name,
      role: "ADMIN",
    });
    const { res, nextCalled } = await runMiddleware(
      authenticate,
      mockRequest(`Bearer ${refresh}`),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "Token is invalid or expired." });
  });

  it("rejects a missing MongoDB user", async () => {
    const token = generateAccessToken({
      user_id: "000000000000000000000000",
      email: "gone@example.com",
      full_name: "Gone",
      role: "ADMIN",
    });
    const { res, nextCalled } = await runMiddleware(
      authenticate,
      mockRequest(`Bearer ${token}`),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "User not found" });
  });

  it("rejects an inactive user", async () => {
    const token = generateAccessToken({
      user_id: DB_USER.id,
      email: DB_USER.email,
      full_name: DB_USER.full_name,
      role: "ADMIN",
    });
    const middleware = createAuthenticateMiddleware({
      loadUser: async () => ({ ...DB_USER, is_active: false }),
    });
    const { res, nextCalled } = await runMiddleware(
      middleware,
      mockRequest(`Bearer ${token}`),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "User is inactive" });
  });

  it("rejects a deleted user", async () => {
    const token = generateAccessToken({
      user_id: DB_USER.id,
      email: DB_USER.email,
      full_name: DB_USER.full_name,
      role: "ADMIN",
    });
    const middleware = createAuthenticateMiddleware({
      loadUser: async () => ({ ...DB_USER, is_deleted: true, is_active: false }),
    });
    const { res, nextCalled } = await runMiddleware(
      middleware,
      mockRequest(`Bearer ${token}`),
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { detail: "User not found" });
  });

  it("attaches the MongoDB user to req.user and ignores the JWT role claim", async () => {
    const token = generateAccessToken({
      user_id: DB_USER.id,
      email: "stale@example.com",
      full_name: "Stale Token Name",
      role: "ADMIN",
    });
    const req = mockRequest(`Bearer ${token}`);
    const { res, nextCalled } = await runMiddleware(authenticate, req);

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(req.user, DB_USER);
    assert.equal(req.user?.role, "RECEPTIONIST");
    assert.notEqual(req.user?.email, "stale@example.com");
  });
});
