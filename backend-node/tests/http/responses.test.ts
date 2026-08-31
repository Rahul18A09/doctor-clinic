import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Response } from "express";

import {
  detailResponse,
  errorResponse,
  notFoundResponse,
  paginatedSuccessResponse,
  successResponse,
  validationErrorResponse,
} from "../../src/http/responses";

type FakeResponse = Response & { statusCode: number; body: unknown };

function fakeRes(): FakeResponse {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as FakeResponse;
}

describe("API response helpers", () => {
  it("omits data on success when none is provided", () => {
    const res = fakeRes();
    successResponse(res, { message: "Logout successful." });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, message: "Logout successful." });
  });

  it("includes data when provided", () => {
    const res = fakeRes();
    successResponse(res, { message: "Ok", data: { id: "1" }, statusCode: 201 });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
      success: true,
      message: "Ok",
      data: { id: "1" },
    });
  });

  it("omits errors on failure when none are provided", () => {
    const res = fakeRes();
    errorResponse(res, { message: "Patient not found.", statusCode: 404 });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      success: false,
      message: "Patient not found.",
    });
  });

  it("includes DRF-style field errors", () => {
    const res = fakeRes();
    errorResponse(res, {
      message: "Incorrect password.",
      errors: { password: ["Incorrect password."] },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      message: "Incorrect password.",
      errors: { password: ["Incorrect password."] },
    });
  });

  it("returns DRF { detail } for 401/403", () => {
    const res = fakeRes();
    detailResponse(res, "Admin access required.", 403);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { detail: "Admin access required." });
  });

  it("notFoundResponse is an enveloped 404", () => {
    const res = fakeRes();
    notFoundResponse(res, "Receptionist not found.");
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      success: false,
      message: "Receptionist not found.",
    });
  });

  it("validationErrorResponse uses the first field error as message", () => {
    const res = fakeRes();
    validationErrorResponse(res, {
      mobile: ["This field is required."],
      age: ["A valid integer is required."],
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      message: "This field is required.",
      errors: {
        mobile: ["This field is required."],
        age: ["A valid integer is required."],
      },
    });
  });

  it("paginatedSuccessResponse uses results + snake_case pagination", () => {
    const res = fakeRes();
    paginatedSuccessResponse(res, {
      message: "Receptionists retrieved successfully.",
      results: [{ id: "1" }],
      pagination: {
        page: 1,
        page_size: 10,
        total: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      message: "Receptionists retrieved successfully.",
      data: {
        results: [{ id: "1" }],
        pagination: {
          page: 1,
          page_size: 10,
          total: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      },
    });
  });
});
