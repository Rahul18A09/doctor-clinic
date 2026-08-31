import assert from "node:assert/strict";
import { describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { openApiDocument } from "../../src/docs/openapi";

const app = createApp();

const DOCUMENTED_PATHS = [
  "/api/v1/health/",
  "/api/v1/auth/login/",
  "/api/v1/auth/logout/",
  "/api/v1/auth/token/refresh/",
  "/api/v1/auth/me/",
  "/api/v1/auth/change-password/",
  "/api/v1/receptionists/",
  "/api/v1/receptionists/{pk}/",
  "/api/v1/receptionists/{pk}/activate/",
  "/api/v1/receptionists/{pk}/deactivate/",
  "/api/v1/patients/",
  "/api/v1/patients/stats/",
  "/api/v1/patients/lookup/",
  "/api/v1/patients/{pk}/",
  "/api/v1/doctor/stats/",
  "/api/v1/doctor/patients/",
  "/api/v1/doctor/patients/completed/",
  "/api/v1/doctor/patients/{pk}/",
  "/api/v1/doctor/patients/{pk}/start/",
  "/api/v1/doctor/patients/{pk}/consultation/",
  "/api/v1/doctor/patients/{pk}/complete/",
  "/api/v1/doctor/patients/{pk}/cancel/",
  "/api/v1/queue/",
  "/api/v1/settings/",
  "/api/v1/settings/clinic/",
  "/api/v1/settings/queue/",
  "/api/v1/settings/notifications/",
  "/api/v1/settings/preferences/",
  "/api/v1/notifications/",
  "/api/v1/notifications/unread-count/",
  "/api/v1/notifications/read-all/",
  "/api/v1/notifications/{id}/read/",
  "/api/v1/notifications/{id}/",
  "/api/v1/reports/",
  "/api/v1/reports/export/",
] as const;

describe("OpenAPI docs", () => {
  it("serves the OpenAPI document at /api/docs/openapi.json", async () => {
    const res = await request(app).get("/api/docs/openapi.json");

    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, "3.0.3");
    assert.equal(res.body.info.title, "Clinic API");
    assert.deepEqual(res.body.paths, openApiDocument["paths"]);

    for (const path of DOCUMENTED_PATHS) {
      assert.ok(res.body.paths[path], `missing path ${path}`);
    }

    assert.deepEqual(Object.keys(res.body.paths).sort(), [...DOCUMENTED_PATHS].sort());

    assert.ok(res.body.paths["/api/v1/queue/"]);
    assert.equal(res.body.paths["/api/v1/queue/"].get.security.length, 0);
    assert.ok(res.body.paths["/api/v1/doctor/patients/"]);
    assert.ok(res.body.paths["/api/v1/doctor/patients/{pk}/start/"]);
    assert.ok(res.body.paths["/api/v1/notifications/"]);
    assert.ok(res.body.paths["/api/v1/notifications/unread-count/"]);
    assert.ok(res.body.paths["/api/v1/notifications/{id}/read/"]);

    assert.equal(res.body.paths["/api/v1/auth/login/"].post.security.length, 0);
    assert.equal(res.body.paths["/api/v1/auth/token/refresh/"].post.security.length, 0);
    assert.equal(res.body.paths["/api/v1/health/"].get.security.length, 0);
    assert.ok(res.body.components.securitySchemes.BearerAuth);
  });

  it("serves Swagger UI at /api/docs/", async () => {
    const res = await request(app).get("/api/docs/");

    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-type"]), /html/);
    assert.match(res.text, /swagger-ui/i);
    assert.match(res.text, /Clinic API docs/);
  });
});
