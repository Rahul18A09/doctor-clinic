import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { utcDatePrefix } from "../../src/http/utc";
import { Patient } from "../../src/models/patient.model";
import { User } from "../../src/models/user.model";
import { getPublicQueueStatus } from "../../src/patients/queue";
import { getPatientStats } from "../../src/patients/stats";

const app = createApp();
const PASSWORD = "QueuePass-Test9x";

describe("queue API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  let stamp = "";
  let adminToken = "";
  let mobileBase = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.qhttp.${Date.now()}`;
    mobileBase = `7${String(Date.now()).slice(-9)}`;

    const admin = await User.create({
      full_name: "Node Queue Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(admin._id));
    adminToken = generateAccessToken({
      user_id: String(admin._id),
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });
  });

  after(async () => {
    if (createdPatientIds.length > 0) {
      await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDatabase();
  });

  function adminAuth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  function trackPatient(id: string): string {
    createdPatientIds.push(id);
    return id;
  }

  it("GET /api/v1/queue/ is public and returns Django envelope keys", async () => {
    const res = await request(app).get("/api/v1/queue/");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Queue status retrieved successfully.");
    assert.equal(typeof res.body.data.todays_token, "string");
    assert.equal(typeof res.body.data.current_token, "string");
    assert.equal(typeof res.body.data.current_patient_name, "string");
    assert.deepEqual(Object.keys(res.body.data).sort(), [
      "current_patient_name",
      "current_token",
      "todays_token",
    ]);
  });

  it("GET /api/v1/queue/ ignores Authorization and matches getPublicQueueStatus", async () => {
    const res = await request(app).get("/api/v1/queue/").set(adminAuth());
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, await getPublicQueueStatus());
  });

  it("registers display P#### tokens while storing YYYYMMDD-P#### for UTC today", async () => {
    const res = await request(app)
      .post("/api/v1/patients/")
      .set(adminAuth())
      .send({
        patient_name: `${stamp} stored-token`,
        mobile: `${mobileBase}0`.slice(0, 20),
        age: 41,
        gender: "FEMALE",
        chief_complaint: "Queue token",
      });
    assert.equal(res.status, 201);
    const patient = res.body.data.patient;
    trackPatient(patient.id);
    assert.match(patient.token_number, /^P\d{4,}$/);

    const stored = await Patient.findById(patient.id).exec();
    assert.ok(stored);
    const prefix = utcDatePrefix();
    assert.equal(stored.token_number.startsWith(`${prefix}-P`), true);
    assert.equal(patient.token_number, stored.token_number.slice(`${prefix}-`.length));
  });

  it("does not issue duplicate token numbers under concurrent registration", async () => {
    const payloads = Array.from({ length: 8 }, (_, index) => ({
      patient_name: `${stamp} race ${index}`,
      mobile: `${mobileBase}${index}`.slice(0, 20),
      age: 20 + index,
      gender: "MALE" as const,
      chief_complaint: "Concurrent",
    }));

    const responses = await Promise.all(
      payloads.map((body) => request(app).post("/api/v1/patients/").set(adminAuth()).send(body)),
    );

    for (const res of responses) {
      assert.equal(res.status, 201, res.body.message);
      trackPatient(res.body.data.patient.id);
    }

    const ids = responses.map((res) => res.body.data.patient.id as string);
    const stored = await Patient.find({ _id: { $in: ids } }).exec();
    const tokens = stored.map((row) => row.token_number);
    assert.equal(tokens.length, 8);
    assert.equal(new Set(tokens).size, 8);

    const prefix = utcDatePrefix();
    for (const token of tokens) {
      assert.equal(token.startsWith(`${prefix}-P`), true);
    }

    const displayTokens = responses.map((res) => res.body.data.patient.token_number as string);
    assert.equal(new Set(displayTokens).size, 8);
  });

  it("advances current from IN_CONSULTATION to the next WAITING after complete", async () => {
    const waitingA = await request(app)
      .post("/api/v1/patients/")
      .set(adminAuth())
      .send({
        patient_name: `${stamp} live-a`,
        mobile: `${mobileBase}a`.slice(0, 20),
        age: 33,
        gender: "MALE",
        chief_complaint: "A",
      });
    const waitingB = await request(app)
      .post("/api/v1/patients/")
      .set(adminAuth())
      .send({
        patient_name: `${stamp} live-b`,
        mobile: `${mobileBase}b`.slice(0, 20),
        age: 34,
        gender: "FEMALE",
        chief_complaint: "B",
      });
    assert.equal(waitingA.status, 201);
    assert.equal(waitingB.status, 201);
    const idA = trackPatient(waitingA.body.data.patient.id);
    trackPatient(waitingB.body.data.patient.id);

    const started = await request(app)
      .post(`/api/v1/doctor/patients/${idA}/start/`)
      .set(adminAuth());
    assert.equal(started.status, 200);

    const afterStart = await request(app).get("/api/v1/queue/");
    assert.equal(afterStart.status, 200);
    assert.deepEqual(afterStart.body.data, await getPublicQueueStatus());

    const completed = await request(app)
      .post(`/api/v1/doctor/patients/${idA}/complete/`)
      .set(adminAuth());
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.patient.status, "COMPLETED");

    const afterComplete = await request(app).get("/api/v1/queue/");
    assert.deepEqual(afterComplete.body.data, await getPublicQueueStatus());
    assert.match(String(afterComplete.body.data.current_token), /^(?:|P\d+)$/);
  });

  it("queue statistics stay aligned with patient stats after queue activity", async () => {
    const stats = await request(app).get("/api/v1/patients/stats/").set(adminAuth());
    assert.equal(stats.status, 200);
    const expected = await getPatientStats();
    assert.deepEqual(stats.body.data, expected);
    for (const key of ["waiting", "in_consultation", "completed", "completed_today", "today"]) {
      assert.equal(typeof stats.body.data[key], "number");
    }
  });
});
