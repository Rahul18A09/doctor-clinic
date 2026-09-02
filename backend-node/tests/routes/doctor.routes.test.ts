import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { Bed } from "../../src/models/bed.model";
import { Patient } from "../../src/models/patient.model";
import { Room } from "../../src/models/room.model";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "DocPass-Test9x";

describe("doctor API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  const createdRoomIds: string[] = [];
  const createdBedIds: string[] = [];
  let stamp = "";
  let tokenBase = "";
  let tokenSeq = 0;
  let adminToken = "";
  let receptionistToken = "";
  let adminId = "";
  let adminName = "";
  let mobile = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.doc.${Date.now()}`;
    tokenBase = Date.now().toString(36);
    mobile = `8${String(Date.now()).slice(-9)}`;

    const admin = await User.create({
      full_name: "Node Doc Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(admin._id));
    adminId = String(admin._id);
    adminName = admin.full_name;
    adminToken = generateAccessToken({
      user_id: adminId,
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });

    const desk = await User.create({
      full_name: "Node Doc Desk",
      email: `${stamp}.desk@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(desk._id));
    receptionistToken = generateAccessToken({
      user_id: String(desk._id),
      email: desk.email,
      full_name: desk.full_name,
      role: "RECEPTIONIST",
    });
  });

  after(async () => {
    if (createdBedIds.length > 0) {
      await Bed.deleteMany({ _id: { $in: createdBedIds } });
    }
    if (createdRoomIds.length > 0) {
      await Room.deleteMany({ _id: { $in: createdRoomIds } });
    }
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

  function deskAuth() {
    return { Authorization: `Bearer ${receptionistToken}` };
  }

  function nextToken(): string {
    tokenSeq += 1;
    return `d${tokenBase}${tokenSeq}`.slice(0, 20);
  }

  async function createPatient(overrides: Record<string, unknown> = {}) {
    const patient = await Patient.create({
      token_number: nextToken(),
      visit_number: 1,
      patient_name: `${stamp} patient`,
      mobile,
      age: 40,
      gender: "MALE",
      chief_complaint: "Fever",
      status: "WAITING",
      created_by: adminId,
      created_by_name: adminName,
      ...overrides,
    });
    createdPatientIds.push(String(patient._id));
    return patient;
  }

  it("GET /api/v1/doctor/patients/ requires JWT and admin", async () => {
    const unauth = await request(app).get("/api/v1/doctor/patients/");
    assert.equal(unauth.status, 401);
    assert.deepEqual(unauth.body, {
      detail: "Authentication credentials were not provided.",
    });

    const forbidden = await request(app).get("/api/v1/doctor/patients/").set(deskAuth());
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { detail: "Admin access required." });
  });

  it("GET /api/v1/doctor/patients/ defaults to WAITING, created_at ascending", async () => {
    const older = await createPatient({
      patient_name: `${stamp} wait-old`,
      created_at: new Date("2026-08-19T10:00:00.000Z"),
    });
    const newer = await createPatient({
      patient_name: `${stamp} wait-new`,
      created_at: new Date("2026-08-19T11:00:00.000Z"),
    });
    const inConsult = await createPatient({
      patient_name: `${stamp} wait-hidden`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
    });

    const res = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ search: `${stamp} wait-`, page_size: 100 })
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Patients retrieved successfully.");
    const ids = res.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(ids.includes(String(older._id)));
    assert.ok(ids.includes(String(newer._id)));
    assert.equal(ids.includes(String(inConsult._id)), false);
    assert.ok(res.body.data.results.every((row: { status: string }) => row.status === "WAITING"));
    assert.ok(ids.indexOf(String(older._id)) < ids.indexOf(String(newer._id)));
    assert.equal(res.body.data.pagination.page_size, 100);
  });

  it("GET /api/v1/doctor/patients/ supports active, today, and completed filters", async () => {
    const waiting = await createPatient({ patient_name: `${stamp} filter-w` });
    const inConsult = await createPatient({
      patient_name: `${stamp} filter-i`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
      consulted_by: adminId,
      consulted_by_name: adminName,
    });
    const completed = await createPatient({
      patient_name: `${stamp} filter-c`,
      status: "COMPLETED",
      consultation_started_at: new Date(),
      consultation_completed_at: new Date(),
      completed_at: new Date(),
    });

    const active = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ status: "active", search: `${stamp} filter-`, page_size: 100 })
      .set(adminAuth());
    const activeIds = active.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(activeIds.includes(String(waiting._id)));
    assert.ok(activeIds.includes(String(inConsult._id)));
    assert.equal(activeIds.includes(String(completed._id)), false);

    const today = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ filter: "today", search: `${stamp} filter-`, page_size: 100 })
      .set(adminAuth());
    const todayIds = today.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(todayIds.includes(String(waiting._id)));
    assert.ok(todayIds.includes(String(inConsult._id)));
    assert.ok(todayIds.includes(String(completed._id)));

    const completedFilter = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ filter: "completed", search: `${stamp} filter-`, page_size: 100 })
      .set(adminAuth());
    const completedIds = completedFilter.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(completedIds.includes(String(completed._id)));
    assert.equal(completedIds.includes(String(waiting._id)), false);
    assert.ok(
      completedFilter.body.data.results.every((row: { status: string }) => row.status === "COMPLETED"),
    );
  });

  it("GET /api/v1/doctor/patients/ sorts IN_CONSULTATION and COMPLETED by timestamps", async () => {
    const firstStart = await createPatient({
      patient_name: `${stamp} sort-i`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date("2026-08-19T10:00:00.000Z"),
    });
    const laterStart = await createPatient({
      patient_name: `${stamp} sort-i`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date("2026-08-19T12:00:00.000Z"),
    });

    const inConsult = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ status: "IN_CONSULTATION", search: `${stamp} sort-i`, page_size: 100 })
      .set(adminAuth());
    const inIds = inConsult.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(inIds.indexOf(String(laterStart._id)) < inIds.indexOf(String(firstStart._id)));

    const firstDone = await createPatient({
      patient_name: `${stamp} sort-c`,
      status: "COMPLETED",
      consultation_completed_at: new Date("2026-08-19T10:00:00.000Z"),
    });
    const laterDone = await createPatient({
      patient_name: `${stamp} sort-c`,
      status: "COMPLETED",
      consultation_completed_at: new Date("2026-08-19T12:00:00.000Z"),
    });

    const completed = await request(app)
      .get("/api/v1/doctor/patients/")
      .query({ status: "COMPLETED", search: `${stamp} sort-c`, page_size: 100 })
      .set(adminAuth());
    const doneIds = completed.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(doneIds.indexOf(String(laterDone._id)) < doneIds.indexOf(String(firstDone._id)));
  });

  it("GET /api/v1/doctor/patients/completed/ lists COMPLETED newest-first and is admin-only", async () => {
    const forbidden = await request(app)
      .get("/api/v1/doctor/patients/completed/")
      .set(deskAuth());
    assert.equal(forbidden.status, 403);

    const older = await createPatient({
      patient_name: `${stamp} done-old`,
      status: "COMPLETED",
      consultation_completed_at: new Date("2026-08-19T09:00:00.000Z"),
    });
    const newer = await createPatient({
      patient_name: `${stamp} done-new`,
      status: "COMPLETED",
      consultation_completed_at: new Date("2026-08-19T13:00:00.000Z"),
    });
    await createPatient({ patient_name: `${stamp} done-wait` });

    const res = await request(app)
      .get("/api/v1/doctor/patients/completed/")
      .query({ search: `${stamp} done-`, page_size: 100 })
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Completed patients retrieved successfully.");
    const ids = res.body.data.results.map((row: { id: string }) => row.id);
    assert.ok(ids.includes(String(older._id)));
    assert.ok(ids.includes(String(newer._id)));
    assert.equal(
      res.body.data.results.some((row: { status: string }) => row.status !== "COMPLETED"),
      false,
    );
    assert.ok(ids.indexOf(String(newer._id)) < ids.indexOf(String(older._id)));
  });

  it("GET /api/v1/doctor/patients/<pk>/ returns a patient and 404s unknown ids", async () => {
    const patient = await createPatient({ patient_name: `${stamp} detail` });
    const res = await request(app)
      .get(`/api/v1/doctor/patients/${String(patient._id)}/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Patient retrieved successfully.");
    assert.equal(res.body.data.patient.id, String(patient._id));
    assert.equal(res.body.data.patient.patient_name, `${stamp} detail`);
    assert.equal(res.body.data.patient.is_editable_by_receptionist, true);

    const missing = await request(app)
      .get("/api/v1/doctor/patients/aaaaaaaaaaaaaaaaaaaaaaaa/")
      .set(adminAuth());
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      message: "Patient not found.",
    });

    const invalid = await request(app)
      .get("/api/v1/doctor/patients/not-an-id/")
      .set(adminAuth());
    assert.equal(invalid.status, 404);

    const startMissing = await request(app)
      .post("/api/v1/doctor/patients/aaaaaaaaaaaaaaaaaaaaaaaa/start/")
      .set(adminAuth());
    assert.equal(startMissing.status, 404);
    assert.equal(startMissing.body.message, "Patient not found.");
  });

  it("POST start moves WAITING → IN_CONSULTATION and records the doctor", async () => {
    const patient = await createPatient({ patient_name: `${stamp} start` });
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/start/`)
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Consultation started successfully.");
    const body = res.body.data.patient;
    assert.equal(body.status, "IN_CONSULTATION");
    assert.equal(body.consulted_by, adminId);
    assert.equal(body.consulted_by_name, adminName);
    assert.ok(body.consultation_started_at);
    assert.equal(body.consultation_completed_at, null);
    assert.equal(body.is_editable_by_receptionist, false);
    assert.equal("errors" in res.body, false);

    const stored = await Patient.findById(patient._id).exec();
    assert.equal(stored?.status, "IN_CONSULTATION");
    assert.equal(stored?.consulted_by, adminId);
  });

  it("POST start rejects non-WAITING without an errors key", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} start-bad`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
    });
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/start/`)
      .set(adminAuth());
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(
      res.body.message,
      "Consultation can only be started for patients with WAITING status.",
    );
    assert.equal("errors" in res.body, false);
  });

  it("POST start is atomic under concurrent requests", async () => {
    const patient = await createPatient({ patient_name: `${stamp} start-race` });
    const url = `/api/v1/doctor/patients/${String(patient._id)}/start/`;
    const [first, second] = await Promise.all([
      request(app).post(url).set(adminAuth()),
      request(app).post(url).set(adminAuth()),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 400]);
    const failed = first.status === 400 ? first : second;
    assert.equal(
      failed.body.message,
      "Consultation can only be started for patients with WAITING status.",
    );

    const stored = await Patient.findById(patient._id).exec();
    assert.equal(stored?.status, "IN_CONSULTATION");
  });

  it("PUT consultation saves optional vitals while IN_CONSULTATION", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} save`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
      consulted_by: adminId,
      consulted_by_name: adminName,
    });

    const empty = await request(app)
      .put(`/api/v1/doctor/patients/${String(patient._id)}/consultation/`)
      .set(adminAuth())
      .send({});
    assert.equal(empty.status, 200);
    assert.equal(empty.body.message, "Consultation saved successfully.");
    assert.equal(empty.body.data.patient.updated_by, adminId);
    assert.equal(empty.body.data.patient.updated_by_name, adminName);

    const saved = await request(app)
      .put(`/api/v1/doctor/patients/${String(patient._id)}/consultation/`)
      .set(adminAuth())
      .send({
        temperature: " 98.6 ",
        blood_pressure: " 120/80 ",
        pulse: "72",
        weight: 70,
        height: null,
        diagnosis: "  Viral fever  ",
        doctor_notes: "  Observe  ",
        prescription: "  Rest  ",
      });
    assert.equal(saved.status, 200);
    const body = saved.body.data.patient;
    assert.equal(body.temperature, 98.6);
    assert.equal(body.blood_pressure, "120/80");
    assert.equal(body.pulse, "72");
    assert.equal(body.weight, 70);
    assert.equal(body.height, null);
    assert.equal(body.diagnosis, "Viral fever");
    assert.equal(body.doctor_notes, "Observe");
    assert.equal(body.prescription, "Rest");
    assert.equal(body.status, "IN_CONSULTATION");
    assert.equal(body.consulted_by, adminId);
  });

  it("PUT consultation validates fields and only allows IN_CONSULTATION", async () => {
    const waiting = await createPatient({ patient_name: `${stamp} save-wait` });
    const blocked = await request(app)
      .put(`/api/v1/doctor/patients/${String(waiting._id)}/consultation/`)
      .set(adminAuth())
      .send({ diagnosis: "nope" });
    assert.equal(blocked.status, 400);
    assert.equal(
      blocked.body.message,
      "Consultation data can only be saved while status is IN_CONSULTATION.",
    );
    assert.equal("errors" in blocked.body, false);

    const inConsult = await createPatient({
      patient_name: `${stamp} save-bad`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
    });
    const invalid = await request(app)
      .put(`/api/v1/doctor/patients/${String(inConsult._id)}/consultation/`)
      .set(adminAuth())
      .send({ temperature: "hot", blood_pressure: null });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.message, "A valid number is required.");
    assert.deepEqual(invalid.body.errors.temperature, ["A valid number is required."]);
    assert.deepEqual(invalid.body.errors.blood_pressure, ["This field may not be null."]);

    const tooLong = await request(app)
      .put(`/api/v1/doctor/patients/${String(inConsult._id)}/consultation/`)
      .set(adminAuth())
      .send({ pulse: "x".repeat(21) });
    assert.equal(tooLong.status, 400);
    assert.deepEqual(tooLong.body.errors.pulse, [
      "Ensure this field has no more than 20 characters.",
    ]);
  });

  it("POST complete from WAITING sets start and completion timestamps together", async () => {
    const patient = await createPatient({ patient_name: `${stamp} complete-wait` });
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/complete/`)
      .set(adminAuth());

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Treatment completed successfully.");
    const body = res.body.data.patient;
    assert.equal(body.status, "COMPLETED");
    assert.equal(body.consulted_by, adminId);
    assert.equal(body.consulted_by_name, adminName);
    assert.equal(body.updated_by, adminId);
    assert.ok(body.consultation_started_at);
    assert.ok(body.consultation_completed_at);
    assert.ok(body.completed_at);
    assert.equal(body.consultation_started_at, body.consultation_completed_at);
  });

  it("POST complete does not release an admitted inpatient bed", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} complete-bed`,
      care_type: "Inpatient",
      admission_status: "Admission Required",
    });
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `DW-${tokenBase}${tokenSeq}`,
      room_type: "WARD",
      floor: "1",
      capacity: 1,
    });
    assert.equal(room.status, 201);
    createdRoomIds.push(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: room.body.data.room.id,
      bed_number: "1",
    });
    assert.equal(bed.status, 201);
    const bedId = bed.body.data.bed.id;
    createdBedIds.push(bedId);

    const assigned = await request(app)
      .post(`/api/v1/beds/${bedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: String(patient._id) });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.bed.status, "occupied");

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/complete/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.patient.status, "COMPLETED");
    assert.equal(res.body.data.patient.admission_status, "Admitted");

    const stillOccupied = await request(app).get(`/api/v1/beds/${bedId}/`).set(adminAuth());
    assert.equal(stillOccupied.status, 200);
    assert.equal(stillOccupied.body.data.bed.status, "occupied");
    assert.equal(stillOccupied.body.data.bed.patient_id, String(patient._id));

    const discharged = await request(app)
      .post(`/api/v1/patients/${String(patient._id)}/discharge/`)
      .set(adminAuth());
    assert.equal(discharged.status, 200);
    assert.equal(discharged.body.data.patient.admission_status, "Discharged");

    const released = await request(app).get(`/api/v1/beds/${bedId}/`).set(adminAuth());
    assert.equal(released.status, 200);
    assert.equal(released.body.data.bed.status, "available");
    assert.equal(released.body.data.bed.patient_id, null);
  });

  it("POST cancel does not release an admitted inpatient bed", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} cancel-bed`,
      status: "IN_CONSULTATION",
      care_type: "Inpatient",
      admission_status: "Admission Required",
    });
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `CX-${tokenBase}${tokenSeq}`,
      room_type: "WARD",
      floor: "1",
      capacity: 1,
    });
    createdRoomIds.push(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: room.body.data.room.id,
      bed_number: "1",
    });
    const bedId = bed.body.data.bed.id;
    createdBedIds.push(bedId);
    await request(app)
      .post(`/api/v1/beds/${bedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: String(patient._id) });

    const cancelled = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/cancel/`)
      .set(adminAuth());
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.patient.status, "WAITING");
    assert.equal(cancelled.body.data.patient.admission_status, "Admitted");

    const occupied = await request(app).get(`/api/v1/beds/${bedId}/`).set(adminAuth());
    assert.equal(occupied.body.data.bed.status, "occupied");
  });

  it("PUT care-type is admin-only and sets Admission Required for Inpatient", async () => {
    const patient = await createPatient({ patient_name: `${stamp} care-type` });
    const desk = await request(app)
      .put(`/api/v1/doctor/patients/${String(patient._id)}/care-type/`)
      .set(deskAuth())
      .send({ care_type: "Inpatient" });
    assert.equal(desk.status, 403);

    const inpatient = await request(app)
      .put(`/api/v1/doctor/patients/${String(patient._id)}/care-type/`)
      .set(adminAuth())
      .send({ care_type: "Inpatient" });
    assert.equal(inpatient.status, 200);
    assert.equal(inpatient.body.data.patient.care_type, "Inpatient");
    assert.equal(inpatient.body.data.patient.admission_status, "Admission Required");

    const outpatient = await request(app)
      .put(`/api/v1/doctor/patients/${String(patient._id)}/care-type/`)
      .set(adminAuth())
      .send({ care_type: "Outpatient" });
    assert.equal(outpatient.status, 200);
    assert.equal(outpatient.body.data.patient.care_type, "Outpatient");
    assert.equal(outpatient.body.data.patient.admission_status, "");
  });

  it("POST complete from IN_CONSULTATION keeps existing start and doctor", async () => {
    const startedAt = new Date("2026-08-19T08:00:00.000Z");
    const patient = await createPatient({
      patient_name: `${stamp} complete-in`,
      status: "IN_CONSULTATION",
      consultation_started_at: startedAt,
      consulted_by: "other-doctor-id",
      consulted_by_name: "Other Doctor",
    });

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/complete/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    const body = res.body.data.patient;
    assert.equal(body.status, "COMPLETED");
    assert.equal(body.consulted_by, "other-doctor-id");
    assert.equal(body.consulted_by_name, "Other Doctor");
    assert.equal(body.updated_by, adminId);
    assert.match(String(body.consultation_started_at), /^2026-08-19T08:00:00/);
    assert.ok(body.consultation_completed_at);
    assert.notEqual(body.consultation_started_at, body.consultation_completed_at);
  });

  it("POST complete rejects COMPLETED without an errors key", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} complete-bad`,
      status: "COMPLETED",
      consultation_completed_at: new Date(),
    });
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/complete/`)
      .set(adminAuth());
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Only waiting or in-consultation patients can be completed.");
    assert.equal("errors" in res.body, false);
  });

  it("POST complete is atomic under concurrent requests", async () => {
    const patient = await createPatient({ patient_name: `${stamp} complete-race` });
    const url = `/api/v1/doctor/patients/${String(patient._id)}/complete/`;
    const [first, second] = await Promise.all([
      request(app).post(url).set(adminAuth()),
      request(app).post(url).set(adminAuth()),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 400]);
    const stored = await Patient.findById(patient._id).exec();
    assert.equal(stored?.status, "COMPLETED");
  });

  it("POST cancel returns IN_CONSULTATION → WAITING and does not use CANCELLED", async () => {
    const patient = await createPatient({
      patient_name: `${stamp} cancel`,
      status: "IN_CONSULTATION",
      consultation_started_at: new Date(),
      consulted_by: adminId,
      consulted_by_name: adminName,
      diagnosis: "keep me",
    });

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/cancel/`)
      .set(adminAuth());
    assert.equal(res.status, 200);
    assert.equal(
      res.body.message,
      "Consultation cancelled. Patient returned to waiting queue.",
    );
    const body = res.body.data.patient;
    assert.equal(body.status, "WAITING");
    assert.equal(body.consultation_started_at, null);
    assert.equal(body.consulted_by, adminId);
    assert.equal(body.consulted_by_name, adminName);
    assert.equal(body.diagnosis, "keep me");

    const stored = await Patient.findById(patient._id).exec();
    assert.equal(stored?.status, "WAITING");
    assert.equal(stored?.consultation_started_at ?? null, null);
    assert.equal(stored?.consulted_by, adminId);
  });

  it("POST cancel rejects WAITING without an errors key", async () => {
    const patient = await createPatient({ patient_name: `${stamp} cancel-wait` });
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${String(patient._id)}/cancel/`)
      .set(adminAuth());
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Only in-progress consultations can be cancelled.");
    assert.equal("errors" in res.body, false);
  });

  it("receptionist cannot start, save, complete, or cancel", async () => {
    const patient = await createPatient({ patient_name: `${stamp} perm` });
    const id = String(patient._id);
    for (const req of [
      request(app).post(`/api/v1/doctor/patients/${id}/start/`),
      request(app).put(`/api/v1/doctor/patients/${id}/consultation/`).send({}),
      request(app).put(`/api/v1/doctor/patients/${id}/care-type/`).send({ care_type: "Inpatient" }),
      request(app).post(`/api/v1/doctor/patients/${id}/complete/`),
      request(app).post(`/api/v1/doctor/patients/${id}/cancel/`),
      request(app).get(`/api/v1/doctor/patients/${id}/`),
      request(app).get("/api/v1/doctor/stats/"),
    ]) {
      const res = await req.set(deskAuth());
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, { detail: "Admin access required." });
    }
  });

  it("GET /api/v1/doctor/stats/ returns the same numbers as patient stats", async () => {
    const before = await request(app).get("/api/v1/doctor/stats/").set(adminAuth());
    assert.equal(before.status, 200);
    assert.equal(before.body.message, "Consultation stats retrieved successfully.");
    for (const key of ["waiting", "in_consultation", "completed", "completed_today", "today"]) {
      assert.equal(typeof before.body.data[key], "number");
    }

    await createPatient({ patient_name: `${stamp} stats` });

    const after = await request(app).get("/api/v1/doctor/stats/").set(adminAuth());
    const patients = await request(app).get("/api/v1/patients/stats/").set(adminAuth());
    assert.equal(after.body.data.today, before.body.data.today + 1);
    assert.equal(after.body.data.waiting, before.body.data.waiting + 1);
    assert.deepEqual(after.body.data, patients.body.data);
    assert.equal(patients.body.message, "Patient stats retrieved successfully.");
  });
});
