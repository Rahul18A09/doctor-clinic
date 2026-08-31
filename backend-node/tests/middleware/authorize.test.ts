import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedUser } from "../../src/auth/types";
import {
  canAccessNotifications,
  canDeletePatients,
  canViewPatients,
  requireAdmin,
  requireAdminOrReceptionist,
  requireReceptionist,
} from "../../src/middleware/authorize";

const ADMIN: AuthenticatedUser = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
  is_active: true,
  is_deleted: false,
};

const RECEPTIONIST: AuthenticatedUser = {
  id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  full_name: "Desk Staff",
  email: "desk@example.com",
  role: "RECEPTIONIST",
  is_active: true,
  is_deleted: false,
};

function mockResponse(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader() {
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function mockRequest(user?: AuthenticatedUser, extras?: Partial<Request>): Request {
  return {
    user,
    body: extras?.body ?? {},
    query: extras?.query ?? {},
    headers: extras?.headers ?? {},
  } as Request;
}

function run(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): { res: ReturnType<typeof mockResponse>; nextCalled: boolean } {
  const res = mockResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

describe("role authorization middleware", () => {
  it("authorizes an admin for ADMIN-only routes", () => {
    const { res, nextCalled } = run(requireAdmin, mockRequest(ADMIN));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it("authorizes a receptionist for RECEPTIONIST-only routes", () => {
    const { res, nextCalled } = run(requireReceptionist, mockRequest(RECEPTIONIST));
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it("authorizes both admin and receptionist for ADMIN-or-RECEPTIONIST routes", () => {
    const adminResult = run(requireAdminOrReceptionist, mockRequest(ADMIN));
    const deskResult = run(requireAdminOrReceptionist, mockRequest(RECEPTIONIST));
    assert.equal(adminResult.nextCalled, true);
    assert.equal(deskResult.nextCalled, true);
  });

  it("rejects an unauthenticated user", () => {
    const { res, nextCalled } = run(requireAdmin, mockRequest());
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      detail: "Authentication credentials were not provided.",
    });
  });

  it("forbids a receptionist on ADMIN-only routes", () => {
    const { res, nextCalled } = run(requireAdmin, mockRequest(RECEPTIONIST));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { detail: "Admin access required." });
  });

  it("forbids an admin on RECEPTIONIST-only routes", () => {
    const { res, nextCalled } = run(requireReceptionist, mockRequest(ADMIN));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { detail: "Receptionist access required." });
  });

  it("ignores a client-supplied role in the request body", () => {
    const req = mockRequest(RECEPTIONIST, { body: { role: "ADMIN" } });
    const { res, nextCalled } = run(requireAdmin, req);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { detail: "Admin access required." });
  });

  it("uses patient permission messages", () => {
    const view = run(canViewPatients, mockRequest(RECEPTIONIST));
    assert.equal(view.nextCalled, true);

    const denied = run(canDeletePatients, mockRequest(RECEPTIONIST));
    assert.equal(denied.nextCalled, false);
    assert.equal(denied.res.statusCode, 403);
    assert.deepEqual(denied.res.body, {
      detail: "Only administrators can delete patients.",
    });
  });

  it("allows admin and receptionist to access notifications", () => {
    const admin = run(canAccessNotifications, mockRequest(ADMIN));
    const desk = run(canAccessNotifications, mockRequest(RECEPTIONIST));
    assert.equal(admin.nextCalled, true);
    assert.equal(desk.nextCalled, true);
  });
});
