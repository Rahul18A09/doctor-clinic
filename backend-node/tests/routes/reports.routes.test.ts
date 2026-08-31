import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { PatientStatus } from "../../src/constants";
import { utcDatePrefix } from "../../src/http/utc";
import { Patient } from "../../src/models/patient.model";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "Reports-Test9x";

describe("reports API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  let stamp = "";
  let tokenSeq = 0;
  let adminToken = "";
  let receptionistToken = "";
  let adminId = "";
  let deskId = "";
  let currentVisitDate = "";
  let previousVisitDate = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.rpt.${Date.now()}`;

    const admin = await User.create({
      full_name: "Reports Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(admin._id));
    adminId = String(admin._id);
    adminToken = generateAccessToken({
      user_id: adminId,
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });

    const desk = await User.create({
      full_name: "Harshad Kakadiya",
      email: `${stamp}.desk@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(desk._id));
    deskId = String(desk._id);
    receptionistToken = generateAccessToken({
      user_id: deskId,
      email: desk.email,
      full_name: desk.full_name,
      role: "RECEPTIONIST",
    });

    const now = new Date("1999-12-15T10:00:00.000Z");
    const previous = new Date("1999-11-10T10:00:00.000Z");
    currentVisitDate = "1999-12-15";
    previousVisitDate = "1999-11-10";

    const currentCompleted = await createVisit({
      created_at: now,
      status: PatientStatus.COMPLETED,
      patient_name: `${stamp} current completed`,
      patient_id: `${stamp}-A`,
      created_by: deskId,
      created_by_name: "Harshad Kakadiya",
      consultation_started_at: new Date("1999-12-15T10:15:00.000Z"),
      consultation_completed_at: new Date("1999-12-15T10:40:00.000Z"),
    });
    const currentWaiting = await createVisit({
      created_at: now,
      status: PatientStatus.WAITING,
      patient_name: `${stamp} current waiting`,
      patient_id: `${stamp}-B`,
      created_by: deskId,
      created_by_name: "Harshad Kakadiya",
    });
    const currentCancelled = await createVisit({
      created_at: now,
      status: PatientStatus.CANCELLED,
      patient_name: `${stamp} current cancelled`,
      patient_id: `${stamp}-A`,
      visit_number: 2,
      created_by: adminId,
      created_by_name: "Reports Admin",
    });
    const previousCompleted = await createVisit({
      created_at: previous,
      status: PatientStatus.COMPLETED,
      patient_name: `${stamp} previous completed`,
      patient_id: `${stamp}-C`,
      created_by: deskId,
      created_by_name: "Harshad Kakadiya",
      consultation_started_at: new Date("1999-11-10T10:20:00.000Z"),
      consultation_completed_at: new Date("1999-11-10T10:50:00.000Z"),
    });

    createdPatientIds.push(
      currentCompleted,
      currentWaiting,
      currentCancelled,
      previousCompleted,
    );
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

  async function createVisit(overrides: Record<string, unknown>): Promise<string> {
    tokenSeq += 1;
    const createdAt = (overrides.created_at as Date) ?? new Date();
    const doc = await Patient.create({
      token_number: `${utcDatePrefix(createdAt)}-P9${String(tokenSeq).padStart(3, "0")}${stamp.slice(-4)}`,
      visit_number: 1,
      mobile: `7${String(Date.now()).slice(-8)}${tokenSeq}`,
      age: 30,
      gender: "MALE",
      chief_complaint: "report test",
      ...overrides,
    });
    return String(doc._id);
  }

  function adminAuth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  it("GET /api/v1/reports/ requires admin JWT", async () => {
    const unauth = await request(app).get("/api/v1/reports/");
    assert.equal(unauth.status, 401);

    const forbidden = await request(app)
      .get("/api/v1/reports/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.detail, "Admin access required.");
  });

  it("GET /api/v1/reports/ rejects invalid date ranges", async () => {
    const inverted = await request(app)
      .get("/api/v1/reports/")
      .query({ start_date: "1999-12-20", end_date: "1999-12-01" })
      .set(adminAuth());
    assert.equal(inverted.status, 400);

    const invalid = await request(app)
      .get("/api/v1/reports/")
      .query({ start_date: "20-12-1999", end_date: "1999-12-21" })
      .set(adminAuth());
    assert.equal(invalid.status, 400);
  });

  it("GET /api/v1/reports/ returns KPIs, trends, and paginated visits for the range", async () => {
    const res = await request(app)
      .get("/api/v1/reports/")
      .query({ start_date: "1999-12-01", end_date: "1999-12-20" })
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Reports retrieved successfully.");

    const data = res.body.data;
    assert.equal(data.range.start_date, "1999-12-01");
    assert.equal(data.range.end_date, "1999-12-20");
    assert.equal(data.kpis.total_visits.value, 3);
    assert.equal(data.kpis.unique_patients.value, 2);
    assert.equal(data.kpis.consultations.value, 1);
    assert.equal(data.kpis.cancelled_visits.value, 1);
    assert.equal(data.consultation_status.waiting, 1);
    assert.equal(data.queue.total_tokens, 3);
    assert.equal(data.queue.completed_tokens, 1);
    assert.equal(data.queue.average_waiting_minutes, 15);
    assert.ok(Array.isArray(data.visits_trend));
    assert.ok(data.visits_trend.some((row: { date: string; visits: number }) => row.date === currentVisitDate && row.visits >= 1));
    assert.ok(data.receptionists.some((row: { full_name: string; visits_created: number }) => row.full_name === "Harshad Kakadiya"));
    assert.equal(data.visits.pagination.total, 3);
    assert.ok(data.visits.results.length > 0);
    assert.equal(typeof data.visits.results[0].token_number, "string");
  });

  it("compares against the previous period of the same length", async () => {
    const res = await request(app)
      .get("/api/v1/reports/")
      .query({ start_date: "1999-12-01", end_date: "1999-12-20" })
      .set(adminAuth());

    const data = res.body.data;
    assert.equal(data.range.previous_start_date, "1999-11-11");
    assert.equal(data.range.previous_end_date, "1999-11-30");
    assert.equal(data.kpis.total_visits.previous, 0);
    assert.equal(data.kpis.total_visits.change_percent, 100);

    const overlapping = await request(app)
      .get("/api/v1/reports/")
      .query({ start_date: "1999-11-01", end_date: "1999-11-30" })
      .set(adminAuth());
    assert.equal(overlapping.status, 200);
    assert.equal(overlapping.body.data.kpis.total_visits.value, 1);
    assert.ok(
      overlapping.body.data.visits_trend.some(
        (row: { date: string; visits: number }) => row.date === previousVisitDate && row.visits >= 1,
      ),
    );
  });

  it("GET /api/v1/reports/export/ returns a CSV of visits", async () => {
    const res = await request(app)
      .get("/api/v1/reports/export/")
      .query({ start_date: "1999-12-01", end_date: "1999-12-20" })
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-type"]), /text\/csv/);
    assert.match(String(res.headers["content-disposition"]), /clinic-reports-1999-12-01-to-1999-12-20\.csv/);
    const body = String(res.text);
    assert.match(body, /Date,Patient,Patient ID,Token,Visit,Status,Registered By/);
    assert.match(body, /current completed/);
    assert.match(body, /COMPLETED/);
  });

  it("GET /api/v1/reports/export/ is admin-only", async () => {
    const forbidden = await request(app)
      .get("/api/v1/reports/export/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(forbidden.status, 403);
  });
});
