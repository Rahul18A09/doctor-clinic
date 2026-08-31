import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { hashDjangoPassword } from "../../src/auth/password";
import { verifyAccessToken, verifyRefreshToken } from "../../src/auth/jwt";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "OldPass-Test9x";
const NEW_PASSWORD = "NewPass-Test8y";

describe("auth API", { timeout: 120_000 }, () => {
  let email = "";
  let userId = "";

  before(async () => {
    await connectDatabase();
    email = `node.auth.test.${Date.now()}@example.com`;
    const user = await User.create({
      full_name: "Node Auth Tester",
      email,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    userId = String(user._id);
  });

  after(async () => {
    if (userId) {
      await User.deleteOne({ _id: userId });
    }
    await disconnectDatabase();
  });

  it("POST /api/v1/auth/login/ succeeds with a Django-compatible password", async () => {
    const res = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Login successful.");
    assert.equal(typeof res.body.data.access, "string");
    assert.equal(typeof res.body.data.refresh, "string");
    assert.equal(res.body.data.user.email, email);
    assert.equal(res.body.data.user.role, "ADMIN");
    assert.equal(res.body.data.user.id, userId);
    assert.equal(res.body.data.user.full_name, "Node Auth Tester");
    assert.ok(res.body.data.user.last_login);
    assert.equal(res.body.data.user.is_active, true);

    const access = verifyAccessToken(res.body.data.access);
    assert.equal(access.user_id, userId);
    assert.equal(access.email, email);
    assert.equal(access.role, "ADMIN");
    assert.equal(access.token_type, "access");

    const refresh = verifyRefreshToken(res.body.data.refresh);
    assert.equal(refresh.token_type, "refresh");
    assert.equal(refresh.user_id, userId);
  });

  it("POST /api/v1/auth/login/ rejects an unknown email with Django's envelope", async () => {
    const res = await request(app).post("/api/v1/auth/login/").send({
      email: "nobody-node-test@example.com",
      password: PASSWORD,
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(
      res.body.message,
      "No account found with email 'nobody-node-test@example.com'.",
    );
    assert.deepEqual(res.body.errors, {
      email: ["No account found with email 'nobody-node-test@example.com'."],
    });
  });

  it("POST /api/v1/auth/login/ rejects an incorrect password", async () => {
    const res = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: "wrong-password",
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Incorrect password.");
    assert.deepEqual(res.body.errors, { password: ["Incorrect password."] });
  });

  it("POST /api/v1/auth/login/ rejects a blank password like Django CharField", async () => {
    const res = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: "",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "This field may not be blank.");
    assert.deepEqual(res.body.errors, {
      password: ["This field may not be blank."],
    });

    const missing = await request(app).post("/api/v1/auth/login/").send({
      email,
    });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body.errors.password, ["This field is required."]);

    const nulled = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: null,
    });
    assert.equal(nulled.status, 400);
    assert.deepEqual(nulled.body.errors.password, ["This field may not be null."]);
  });

  it("malformed JSON returns a DRF-style { detail } 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login/")
      .set("Content-Type", "application/json")
      .send("{");
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.detail, "string");
    assert.match(res.body.detail, /^JSON parse error -/);
  });

  it("GET /api/v1/auth/me/ requires a Bearer access token", async () => {
    const unauth = await request(app).get("/api/v1/auth/me/");
    assert.equal(unauth.status, 401);
    assert.deepEqual(unauth.body, {
      detail: "Authentication credentials were not provided.",
    });

    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    const me = await request(app)
      .get("/api/v1/auth/me/")
      .set("Authorization", `Bearer ${login.body.data.access}`);

    assert.equal(me.status, 200);
    assert.equal(me.body.success, true);
    assert.equal(me.body.message, "User retrieved successfully.");
    assert.equal(me.body.data.user.email, email);
    assert.equal(me.body.data.user.id, userId);
    assert.equal(me.body.data.user.mobile, "");
    assert.equal(me.body.data.user.role, "ADMIN");
    assert.equal(typeof me.body.data.user.created_at, "string");
  });

  it("PATCH /api/v1/auth/me/ allows an admin to update full_name and mobile only", async () => {
    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    const token = login.body.data.access as string;

    const updated = await request(app)
      .patch("/api/v1/auth/me/")
      .set("Authorization", `Bearer ${token}`)
      .send({
        full_name: "System Administrator",
        mobile: "9876543210",
        role: "RECEPTIONIST",
        is_active: false,
        email: "attacker@example.com",
      });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.success, true);
    assert.equal(updated.body.message, "Profile updated successfully.");
    assert.equal(updated.body.data.user.full_name, "System Administrator");
    assert.equal(updated.body.data.user.mobile, "9876543210");
    assert.equal(updated.body.data.user.role, "ADMIN");
    assert.equal(updated.body.data.user.is_active, true);
    assert.equal(updated.body.data.user.email, email);

    const restored = await request(app)
      .patch("/api/v1/auth/me/")
      .set("Authorization", `Bearer ${token}`)
      .send({ full_name: "Node Auth Tester", mobile: "" });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.user.full_name, "Node Auth Tester");
    assert.equal(restored.body.data.user.mobile, "");
    assert.equal(restored.body.data.user.role, "ADMIN");
  });

  it("PATCH /api/v1/auth/me/ updates full_name and mobile only", async () => {
    const recEmail = `node.auth.profile.${Date.now()}@example.com`;
    const rec = await User.create({
      full_name: "Profile Tester",
      email: recEmail,
      password: await hashDjangoPassword(PASSWORD),
      mobile: "9876543210",
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    const recId = String(rec._id);

    try {
      const unauth = await request(app).patch("/api/v1/auth/me/").send({
        full_name: "Should Fail",
      });
      assert.equal(unauth.status, 401);

      const login = await request(app).post("/api/v1/auth/login/").send({
        email: recEmail,
        password: PASSWORD,
      });
      const token = login.body.data.access as string;

      const empty = await request(app)
        .patch("/api/v1/auth/me/")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      assert.equal(empty.status, 400);
      assert.equal(empty.body.message, "Provide full_name or mobile.");

      const invalidMobile = await request(app)
        .patch("/api/v1/auth/me/")
        .set("Authorization", `Bearer ${token}`)
        .send({ mobile: "12345" });
      assert.equal(invalidMobile.status, 400);
      assert.deepEqual(invalidMobile.body.errors.mobile, [
        "Enter a valid 10-digit mobile number.",
      ]);

      const updated = await request(app)
        .patch("/api/v1/auth/me/")
        .set("Authorization", `Bearer ${token}`)
        .send({
          full_name: "Harshad Kakadiya",
          mobile: "9123456789",
          role: "ADMIN",
          is_active: false,
          email: "attacker@example.com",
        });

      assert.equal(updated.status, 200);
      assert.equal(updated.body.success, true);
      assert.equal(updated.body.message, "Profile updated successfully.");
      assert.equal(updated.body.data.user.full_name, "Harshad Kakadiya");
      assert.equal(updated.body.data.user.mobile, "9123456789");
      assert.equal(updated.body.data.user.role, "RECEPTIONIST");
      assert.equal(updated.body.data.user.is_active, true);
      assert.equal(updated.body.data.user.email, recEmail);

      const stored = await User.findById(recId).exec();
      assert.equal(stored?.full_name, "Harshad Kakadiya");
      assert.equal(stored?.mobile, "9123456789");
      assert.equal(stored?.role, "RECEPTIONIST");
      assert.equal(stored?.is_active, true);
      assert.equal(stored?.email, recEmail);
    } finally {
      await User.deleteOne({ _id: recId });
    }
  });

  it("POST /api/v1/auth/logout/ succeeds when authenticated", async () => {
    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    const res = await request(app)
      .post("/api/v1/auth/logout/")
      .set("Authorization", `Bearer ${login.body.data.access}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Logout successful.");
    assert.equal(res.body.data, undefined);
  });

  it("POST /api/v1/auth/token/refresh/ rotates refresh tokens", async () => {
    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    const oldRefresh = login.body.data.refresh as string;

    const res = await request(app).post("/api/v1/auth/token/refresh/").send({
      refresh: oldRefresh,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Token refreshed successfully.");
    assert.equal(typeof res.body.data.access, "string");
    assert.equal(typeof res.body.data.refresh, "string");
    assert.notEqual(res.body.data.refresh, oldRefresh);

    const newAccess = verifyAccessToken(res.body.data.access);
    assert.equal(newAccess.user_id, userId);
    verifyRefreshToken(res.body.data.refresh);
    verifyRefreshToken(oldRefresh);
  });

  it("POST /api/v1/auth/token/refresh/ rejects a missing refresh field", async () => {
    const res = await request(app).post("/api/v1/auth/token/refresh/").send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Token refresh failed.");
    assert.deepEqual(res.body.errors, { refresh: ["This field is required."] });
  });

  it("POST /api/v1/auth/change-password/ updates the hash and keeps Django pbkdf2_sha256", async () => {
    const login = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    const res = await request(app)
      .post("/api/v1/auth/change-password/")
      .set("Authorization", `Bearer ${login.body.data.access}`)
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Password changed successfully.");

    const oldLogin = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: PASSWORD,
    });
    assert.equal(oldLogin.status, 400);

    const newLogin = await request(app).post("/api/v1/auth/login/").send({
      email,
      password: NEW_PASSWORD,
    });
    assert.equal(newLogin.status, 200);

    const stored = await User.findById(userId).exec();
    assert.ok(stored?.password.startsWith("pbkdf2_sha256$1200000$"));
  });

  it("matches Django login error envelope when Django is reachable", async () => {
    const payload = {
      email: "nobody-node-test@example.com",
      password: "irrelevant",
    };
    const nodeRes = await request(app).post("/api/v1/auth/login/").send(payload);

    try {
      const djangoRes = await fetch("http://127.0.0.1:8000/api/v1/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const djangoBody = (await djangoRes.json()) as Record<string, unknown>;
      assert.equal(nodeRes.status, djangoRes.status);
      assert.equal(nodeRes.body.success, djangoBody["success"]);
      assert.equal(nodeRes.body.message, djangoBody["message"]);
      assert.deepEqual(nodeRes.body.errors, djangoBody["errors"]);
    } catch (error: unknown) {
      if (error instanceof assert.AssertionError) {
        throw error;
      }
      assert.equal(nodeRes.status, 400);
      assert.equal(nodeRes.body.success, false);
    }
  });
});
