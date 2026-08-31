import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "RcptPass-Test9x";
const SERIALIZER_KEYS = [
  "id",
  "full_name",
  "email",
  "mobile",
  "gender",
  "is_active",
  "created_at",
  "updated_at",
];

describe("receptionist API", { timeout: 120_000 }, () => {
  const createdIds: string[] = [];
  let stamp = "";
  let adminToken = "";
  let receptionistToken = "";
  let adminId = "";
  let actorId = "";
  let subjectId = "";
  let subjectEmail = "";
  let subjectMobile = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.rcpt.${Date.now()}`;

    const admin = await User.create({
      full_name: "Node Rcpt Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    adminId = String(admin._id);
    createdIds.push(adminId);
    adminToken = generateAccessToken({
      user_id: adminId,
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });

    const actor = await User.create({
      full_name: "Node Rcpt Actor",
      email: `${stamp}.actor@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      mobile: "9000000001",
      gender: "MALE",
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    actorId = String(actor._id);
    createdIds.push(actorId);
    receptionistToken = generateAccessToken({
      user_id: actorId,
      email: actor.email,
      full_name: actor.full_name,
      role: "RECEPTIONIST",
    });

    subjectEmail = `${stamp}.subject@example.com`;
    subjectMobile = "9000000002";
    const subject = await User.create({
      full_name: "Node Rcpt Subject",
      email: subjectEmail,
      password: await hashDjangoPassword(PASSWORD),
      mobile: subjectMobile,
      gender: "FEMALE",
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    subjectId = String(subject._id);
    createdIds.push(subjectId);
  });

  after(async () => {
    if (createdIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdIds } });
    }
    await disconnectDatabase();
  });

  function adminAuth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  function assertSerializerShape(row: Record<string, unknown>): void {
    assert.deepEqual(Object.keys(row).sort(), [...SERIALIZER_KEYS].sort());
    assert.equal("password" in row, false);
    assert.equal("role" in row, false);
    assert.equal("is_deleted" in row, false);
    assert.equal(typeof row["mobile"], "string");
    assert.equal(typeof row["gender"], "string");
  }

  it("GET /api/v1/receptionists/ requires a Bearer token", async () => {
    const res = await request(app).get("/api/v1/receptionists/");
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, {
      detail: "Authentication credentials were not provided.",
    });
  });

  it("GET /api/v1/receptionists/ forbids a receptionist", async () => {
    const res = await request(app)
      .get("/api/v1/receptionists/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { detail: "Admin access required." });
  });

  it("GET /api/v1/receptionists/ lists non-deleted receptionists with Django pagination", async () => {
    const res = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: stamp, page: 1, page_size: 1 })
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Receptionists retrieved successfully.");
    assert.equal(res.body.data.results.length, 1);
    assertSerializerShape(res.body.data.results[0]);
    assert.deepEqual(res.body.data.pagination, {
      page: 1,
      page_size: 1,
      total: 2,
      total_pages: 2,
      has_next: true,
      has_previous: false,
    });

    const page2 = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: stamp, page: 2, page_size: 1 })
      .set(adminAuth());
    assert.equal(page2.status, 200);
    assert.equal(page2.body.data.pagination.has_previous, true);
    assert.equal(page2.body.data.pagination.has_next, false);
    assert.equal(page2.body.data.results.length, 1);
  });

  it("GET /api/v1/receptionists/ searches full_name, email, and mobile and excludes admins", async () => {
    const byName = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: "Node Rcpt Subject" })
      .set(adminAuth());
    assert.equal(byName.status, 200);
    assert.ok(byName.body.data.results.some((row: { id: string }) => row.id === subjectId));

    const byMobile = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: subjectMobile })
      .set(adminAuth());
    assert.ok(byMobile.body.data.results.some((row: { id: string }) => row.id === subjectId));

    const byAdminEmail = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: `${stamp}.admin@example.com` })
      .set(adminAuth());
    assert.equal(byAdminEmail.body.data.results.length, 0);

    const listedIds = new Set(
      (
        await request(app)
          .get("/api/v1/receptionists/")
          .query({ search: stamp, page_size: 100 })
          .set(adminAuth())
      ).body.data.results.map((row: { id: string }) => row.id),
    );
    assert.equal(listedIds.has(adminId), false);
  });

  it("GET /api/v1/receptionists/ uses default page_size 10 and matches Mongo counts", async () => {
    const mongoCount = await User.countDocuments({
      role: "RECEPTIONIST",
      is_deleted: false,
    }).exec();
    const res = await request(app).get("/api/v1/receptionists/").set(adminAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pagination.page, 1);
    assert.equal(res.body.data.pagination.page_size, 10);
    assert.equal(res.body.data.pagination.total, mongoCount);
    for (const row of res.body.data.results) {
      assertSerializerShape(row);
    }
  });

  it("POST /api/v1/receptionists/ creates a receptionist with Django fields and hash", async () => {
    const email = `${stamp}.created@example.com`;
    const res = await request(app)
      .post("/api/v1/receptionists/")
      .set(adminAuth())
      .send({
        full_name: "  Node Rcpt Created  ",
        email: `  ${email.toUpperCase()}  `,
        mobile: " 9000000003 ",
        password: PASSWORD,
        confirm_password: PASSWORD,
        gender: "OTHER",
        role: "ADMIN",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Receptionist created successfully.");
    assertSerializerShape(res.body.data.receptionist);
    assert.equal(res.body.data.receptionist.full_name, "Node Rcpt Created");
    assert.equal(res.body.data.receptionist.email, email);
    assert.equal(res.body.data.receptionist.mobile, "9000000003");
    assert.equal(res.body.data.receptionist.gender, "OTHER");
    assert.equal(res.body.data.receptionist.is_active, true);

    const id = res.body.data.receptionist.id as string;
    createdIds.push(id);
    const stored = await User.findById(id).exec();
    assert.ok(stored);
    assert.equal(stored.role, "RECEPTIONIST");
    assert.equal(stored.is_deleted, false);
    assert.ok(stored.password.startsWith("pbkdf2_sha256$1200000$"));

    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.role, "RECEPTIONIST");
  });

  it("POST /api/v1/receptionists/ validates required fields and duplicate email", async () => {
    const missing = await request(app)
      .post("/api/v1/receptionists/")
      .set(adminAuth())
      .send({});
    assert.equal(missing.status, 400);
    assert.equal(missing.body.success, false);
    assert.equal(missing.body.message, "This field is required.");
    assert.deepEqual(missing.body.errors.full_name, ["This field is required."]);

    const mismatch = await request(app)
      .post("/api/v1/receptionists/")
      .set(adminAuth())
      .send({
        full_name: "Mismatch",
        email: `${stamp}.mismatch@example.com`,
        mobile: "9000000004",
        password: PASSWORD,
        confirm_password: "OtherPass-Test9x",
        gender: "MALE",
      });
    assert.equal(mismatch.status, 400);
    assert.deepEqual(mismatch.body.errors.confirm_password, ["Passwords do not match."]);

    const duplicate = await request(app)
      .post("/api/v1/receptionists/")
      .set(adminAuth())
      .send({
        full_name: "Dup",
        email: subjectEmail,
        mobile: "9000000005",
        password: PASSWORD,
        confirm_password: PASSWORD,
        gender: "MALE",
      });
    assert.equal(duplicate.status, 400);
    assert.deepEqual(duplicate.body.errors.email, ["A user with this email already exists."]);
  });

  it("GET /api/v1/receptionists/<pk>/ returns one receptionist and 404s unknown ids", async () => {
    const res = await request(app)
      .get(`/api/v1/receptionists/${subjectId}/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Receptionist retrieved successfully.");
    assert.equal(res.body.data.receptionist.id, subjectId);
    assert.equal(res.body.data.receptionist.email, subjectEmail);
    assertSerializerShape(res.body.data.receptionist);

    const missing = await request(app)
      .get("/api/v1/receptionists/aaaaaaaaaaaaaaaaaaaaaaaa/")
      .set(adminAuth());
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      message: "Receptionist not found.",
    });

    const invalid = await request(app)
      .get("/api/v1/receptionists/not-an-id/")
      .set(adminAuth());
    assert.equal(invalid.status, 404);

    const adminAsPk = await request(app)
      .get(`/api/v1/receptionists/${adminId}/`)
      .set(adminAuth());
    assert.equal(adminAsPk.status, 404);
  });

  it("PUT /api/v1/receptionists/<pk>/ partially updates fields and ignores password", async () => {
    const res = await request(app)
      .put(`/api/v1/receptionists/${subjectId}/`)
      .set(adminAuth())
      .send({
        full_name: "  Node Rcpt Updated  ",
        password: "ShouldIgnore-Test9x",
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Receptionist updated successfully.");
    assert.equal(res.body.data.receptionist.full_name, "Node Rcpt Updated");
    assert.equal(res.body.data.receptionist.email, subjectEmail);

    const stored = await User.findById(subjectId).exec();
    assert.ok(stored?.password.startsWith("pbkdf2_sha256$"));
    const login = await request(app).post("/api/v1/auth/login/").send({
      email: subjectEmail,
      password: PASSWORD,
    });
    assert.equal(login.status, 200);
  });

  it("POST activate/deactivate toggles is_active without deleting", async () => {
    const off = await request(app)
      .post(`/api/v1/receptionists/${subjectId}/deactivate/`)
      .set(adminAuth());
    assert.equal(off.status, 200);
    assert.equal(off.body.message, "Receptionist deactivated successfully.");
    assert.equal(off.body.data.receptionist.is_active, false);

    const storedOff = await User.findById(subjectId).exec();
    assert.equal(storedOff?.is_active, false);
    assert.equal(storedOff?.is_deleted, false);

    const blockedLogin = await request(app).post("/api/v1/auth/login/").send({
      email: subjectEmail,
      password: PASSWORD,
    });
    assert.equal(blockedLogin.status, 400);
    assert.deepEqual(blockedLogin.body.errors, {
      non_field_errors: ["This account has been deactivated."],
    });

    const on = await request(app)
      .post(`/api/v1/receptionists/${subjectId}/activate/`)
      .set(adminAuth());
    assert.equal(on.status, 200);
    assert.equal(on.body.message, "Receptionist activated successfully.");
    assert.equal(on.body.data.receptionist.is_active, true);

    const allowedLogin = await request(app).post("/api/v1/auth/login/").send({
      email: subjectEmail,
      password: PASSWORD,
    });
    assert.equal(allowedLogin.status, 200);
  });

  it("DELETE /api/v1/receptionists/<pk>/ soft-deletes and hides the user", async () => {
    const res = await request(app)
      .delete(`/api/v1/receptionists/${subjectId}/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      success: true,
      message: "Receptionist deleted successfully.",
    });

    const stored = await User.findById(subjectId).exec();
    assert.equal(stored?.is_deleted, true);
    assert.equal(stored?.is_active, false);

    const getDeleted = await request(app)
      .get(`/api/v1/receptionists/${subjectId}/`)
      .set(adminAuth());
    assert.equal(getDeleted.status, 404);

    const list = await request(app)
      .get("/api/v1/receptionists/")
      .query({ search: subjectEmail })
      .set(adminAuth());
    assert.equal(list.body.data.results.length, 0);

    const login = await request(app).post("/api/v1/auth/login/").send({
      email: subjectEmail,
      password: PASSWORD,
    });
    assert.equal(login.status, 400);
    assert.deepEqual(login.body.errors, {
      non_field_errors: ["This account has been deactivated."],
    });
  });

  it("serializes existing MongoDB receptionist documents without changing them", async () => {
    const existing = await User.findOne({
      role: "RECEPTIONIST",
      is_deleted: false,
      _id: { $nin: createdIds },
    }).exec();

    if (!existing) {
      const ours = await User.findById(actorId).lean().exec();
      assert.ok(ours);
      assert.equal(ours.role, "RECEPTIONIST");
      assert.equal(typeof ours.full_name, "string");
      assert.equal(typeof ours.email, "string");
      return;
    }

    const rawBefore = await User.collection.findOne({ _id: existing._id });
    const res = await request(app)
      .get(`/api/v1/receptionists/${String(existing._id)}/`)
      .set(adminAuth());
    const rawAfter = await User.collection.findOne({ _id: existing._id });

    assert.equal(res.status, 200);
    assertSerializerShape(res.body.data.receptionist);
    assert.equal(res.body.data.receptionist.id, String(existing._id));
    assert.equal(res.body.data.receptionist.email, existing.email);
    assert.equal(res.body.data.receptionist.mobile, existing.mobile ?? "");
    assert.equal(res.body.data.receptionist.gender, existing.gender ?? "");
    assert.deepEqual(rawAfter, rawBefore);
  });
});
