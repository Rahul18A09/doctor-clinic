import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { UserRole } from "../../src/constants";
import { Settings } from "../../src/models/settings.model";
import { User } from "../../src/models/user.model";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../../src/settings/defaults";

const app = createApp();
const PASSWORD = "Settings-Test9x";

function accessFor(user: { _id: { toString(): string }; email: string; full_name: string; role: string }) {
  return generateAccessToken({
    user_id: String(user._id),
    email: user.email,
    full_name: user.full_name,
    role: user.role as UserRole,
  });
}

describe("settings API", { timeout: 120_000 }, () => {
  let adminToken = "";
  let receptionistToken = "";
  let adminId = "";
  let receptionistId = "";

  before(async () => {
    await connectDatabase();
    await Settings.deleteOne({ key: SETTINGS_KEY });

    const stamp = `node.settings.${Date.now()}`;
    const admin = await User.create({
      full_name: "Settings Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    const receptionist = await User.create({
      full_name: "Settings Receptionist",
      email: `${stamp}.rcpt@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    adminId = String(admin._id);
    receptionistId = String(receptionist._id);
    adminToken = accessFor(admin);
    receptionistToken = accessFor(receptionist);
  });

  after(async () => {
    await Settings.deleteOne({ key: SETTINGS_KEY });
    if (adminId) await User.deleteOne({ _id: adminId });
    if (receptionistId) await User.deleteOne({ _id: receptionistId });
    await disconnectDatabase();
  });

  it("GET /api/v1/settings/ requires admin JWT", async () => {
    const unauth = await request(app).get("/api/v1/settings/");
    assert.equal(unauth.status, 401);

    const forbidden = await request(app)
      .get("/api/v1/settings/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.detail, "Admin access required.");
  });

  it("GET /api/v1/settings/ creates defaults and returns all sections", async () => {
    const res = await request(app)
      .get("/api/v1/settings/")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Settings retrieved successfully.");
    assert.deepEqual(res.body.data.settings.clinic, DEFAULT_SETTINGS.clinic);
    assert.deepEqual(res.body.data.settings.queue, DEFAULT_SETTINGS.queue);
    assert.deepEqual(res.body.data.settings.notifications, DEFAULT_SETTINGS.notifications);
    assert.deepEqual(res.body.data.settings.preferences, DEFAULT_SETTINGS.preferences);
    assert.ok(res.body.data.settings.updated_at);
  });

  it("PATCH /api/v1/settings/clinic/ updates clinic only and validates fields", async () => {
    const invalid = await request(app)
      .patch("/api/v1/settings/clinic/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "",
        phone: "+91 90000 11111",
        email: "not-an-email",
        address: "New address",
        working_days: "WEEKENDS",
        opening_time: "09:00",
        closing_time: "08:00",
      });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);
    assert.ok(invalid.body.errors);

    const updated = await request(app)
      .patch("/api/v1/settings/clinic/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "City Care Clinic",
        phone: "+91 90000 11111",
        email: "clinic@citycare.com",
        address: "12 Park Road",
        working_days: "MONDAY_FRIDAY",
        opening_time: "09:00",
        closing_time: "17:30",
      });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.message, "Clinic settings updated successfully.");
    assert.equal(updated.body.data.settings.clinic.name, "City Care Clinic");
    assert.equal(updated.body.data.settings.clinic.working_days, "MONDAY_FRIDAY");
    assert.deepEqual(updated.body.data.settings.queue, DEFAULT_SETTINGS.queue);
  });

  it("PATCH /api/v1/settings/queue/ updates queue only and rejects bad token format", async () => {
    const invalid = await request(app)
      .patch("/api/v1/settings/queue/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        token_format: "P1",
        daily_token_reset: true,
        queue_start_time: "09:00",
        queue_end_time: "18:00",
        max_daily_tokens: 50,
      });
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.body.errors.token_format, [
      "Token format must be 2 digits, for example 01.",
    ]);

    const updated = await request(app)
      .patch("/api/v1/settings/queue/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        token_format: "01",
        daily_token_reset: false,
        queue_start_time: "08:30",
        queue_end_time: "20:00",
        max_daily_tokens: null,
      });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.settings.queue.token_format, "01");
    assert.equal(updated.body.data.settings.queue.daily_token_reset, false);
    assert.equal(updated.body.data.settings.queue.max_daily_tokens, null);
    assert.equal(updated.body.data.settings.clinic.name, "City Care Clinic");
  });

  it("PATCH /api/v1/settings/notifications/ updates notification flags", async () => {
    const updated = await request(app)
      .patch("/api/v1/settings/notifications/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        patient_registration: false,
        token_generated: true,
        token_approaching: false,
        consultation_completed: true,
      });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.settings.notifications.patient_registration, false);
    assert.equal(updated.body.data.settings.notifications.token_approaching, false);
    assert.equal(updated.body.data.settings.queue.token_format, "01");
  });

  it("PATCH /api/v1/settings/preferences/ updates preferences and rejects unknown timezone", async () => {
    const invalid = await request(app)
      .patch("/api/v1/settings/preferences/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        date_format: "DD/MM/YYYY",
        time_format: "12_HOUR",
        timezone: "Mars/Phobos",
        language: "en",
      });
    assert.equal(invalid.status, 400);
    assert.match(String(invalid.body.errors.timezone), /not a valid choice/);

    const updated = await request(app)
      .patch("/api/v1/settings/preferences/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        date_format: "YYYY-MM-DD",
        time_format: "24_HOUR",
        timezone: "UTC",
        language: "gu",
      });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.settings.preferences.date_format, "YYYY-MM-DD");
    assert.equal(updated.body.data.settings.preferences.time_format, "24_HOUR");
    assert.equal(updated.body.data.settings.preferences.timezone, "UTC");
    assert.equal(updated.body.data.settings.preferences.language, "gu");
    assert.equal(updated.body.data.settings.clinic.name, "City Care Clinic");
  });
});
