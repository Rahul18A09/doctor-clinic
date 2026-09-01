import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { utcDatePrefix } from "../../src/http/utc";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { Patient } from "../../src/models/patient.model";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "PatPass-Test9x";

describe("patient API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  let stamp = "";
  let adminToken = "";
  let receptionistToken = "";
  let mobileA = "";
  let adminId = "";
  let waitingId = "";
  let inConsultId = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.pat.${Date.now()}`;
    mobileA = `9${String(Date.now()).slice(-9)}`;

    const admin = await User.create({
      full_name: "Node Pat Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    createdUserIds.push(String(admin._id));
    adminId = String(admin._id);
    adminToken = generateAccessToken({
      user_id: String(admin._id),
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });

    const desk = await User.create({
      full_name: "Node Pat Desk",
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

  function trackPatient(id: string): string {
    createdPatientIds.push(id);
    return id;
  }

  it("GET /api/v1/patients/ requires JWT and allows receptionist", async () => {
    const unauth = await request(app).get("/api/v1/patients/");
    assert.equal(unauth.status, 401);
    assert.deepEqual(unauth.body, {
      detail: "Authentication credentials were not provided.",
    });

    const res = await request(app).get("/api/v1/patients/").set(deskAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Patients retrieved successfully.");
    assert.equal(res.body.data.pagination.page_size, 10);
  });

  it("POST /api/v1/patients/ registers a WAITING patient with display token", async () => {
    const res = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: "  Node Pat Alpha  ",
        mobile: ` ${mobileA} `,
        age: 34,
        gender: "FEMALE",
        blood_group: "A+",
        address: "  12 Clinic Rd  ",
        chief_complaint: "  Fever  ",
        status: "COMPLETED",
        token_number: "HACKED",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Patient registered successfully.");
    const patient = res.body.data.patient;
    waitingId = trackPatient(patient.id);
    assert.equal(patient.patient_name, "Node Pat Alpha");
    assert.equal(patient.mobile, mobileA);
    assert.equal(patient.address, "12 Clinic Rd");
    assert.equal(patient.chief_complaint, "Fever");
    assert.equal(patient.status, "WAITING");
    assert.equal(patient.visit_number, 1);
    assert.match(patient.token_number, /^P\d{4}$/);
    assert.equal(patient.patient_id, waitingId);
    assert.equal(patient.is_editable_by_receptionist, true);
    assert.equal(patient.is_editable_by_admin, true);
    assert.equal(patient.temperature, null);

    const stored = await Patient.findById(waitingId).exec();
    assert.ok(stored);
    assert.ok(stored.token_number.startsWith(`${utcDatePrefix()}-P`));
    assert.equal(stored.status, "WAITING");
  });

  it("POST /api/v1/patients/ increments visit_number for the same mobile", async () => {
    const res = await request(app)
      .post("/api/v1/patients/")
      .set(adminAuth())
      .send({
        patient_name: "Node Pat Alpha 2",
        mobile: mobileA,
        age: 34,
        gender: "FEMALE",
        chief_complaint: "Follow up",
      });
    assert.equal(res.status, 201);
    trackPatient(res.body.data.patient.id);
    assert.equal(res.body.data.patient.visit_number, 2);
    assert.equal(res.body.data.patient.patient_id, waitingId);
    assert.notEqual(res.body.data.patient.id, waitingId);
    assert.match(res.body.data.patient.token_number, /^P\d{4}$/);
    assert.notEqual(res.body.data.patient.token_number, (await request(app).get(`/api/v1/patients/${waitingId}/`).set(deskAuth())).body.data.patient.token_number);
  });

  it("POST /api/v1/patients/ returns DRF field errors", async () => {
    const res = await request(app).post("/api/v1/patients/").set(deskAuth()).send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "This field is required.");
    assert.deepEqual(res.body.errors.patient_name, ["This field is required."]);
  });

  it("GET /api/v1/patients/search/filter/date match Django apply_filters", async () => {
    const byName = await request(app)
      .get("/api/v1/patients/")
      .query({ search: "Node Pat Alpha" })
      .set(deskAuth());
    assert.ok(byName.body.data.results.some((row: { id: string }) => row.id === waitingId));

    const waiting = await request(app)
      .get("/api/v1/patients/")
      .query({ filter: "waiting", search: "Node Pat Alpha" })
      .set(deskAuth());
    assert.ok(waiting.body.data.results.every((row: { status: string }) => row.status === "WAITING"));

    const today = await request(app)
      .get("/api/v1/patients/")
      .query({ filter: "today", search: "Node Pat Alpha" })
      .set(deskAuth());
    assert.ok(today.body.data.results.length >= 1);

    const invalidDate = await request(app)
      .get("/api/v1/patients/")
      .query({ date: "not-a-date", filter: "today", search: "Node Pat Alpha" })
      .set(deskAuth());
    assert.equal(invalidDate.status, 200);
  });

  it("GET /api/v1/patients/lookup/ finds returning patients by exact mobile", async () => {
    const missing = await request(app).get("/api/v1/patients/lookup/").set(deskAuth());
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, {
      success: false,
      message: "Enter a mobile number or patient name.",
    });

    const none = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ mobile: "0000000000" })
      .set(deskAuth());
    assert.equal(none.status, 200);
    assert.equal(none.body.message, "No previous visits found for this mobile number.");
    assert.deepEqual(none.body.data, {
      found: false,
      mobile: "0000000000",
      visit_count: 0,
      next_visit_number: 1,
    });

    const found = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ mobile: ` ${mobileA} ` })
      .set(deskAuth());
    assert.equal(found.status, 200);
    assert.equal(found.body.message, "Returning patient found.");
    assert.equal(found.body.data.found, true);
    assert.equal(found.body.data.mobile, mobileA);
    assert.equal(found.body.data.visit_count, 2);
    assert.equal(found.body.data.next_visit_number, 3);
    assert.equal(found.body.data.patient_id, waitingId);
    assert.equal(found.body.data.patient.patient_name, "Node Pat Alpha 2");
    assert.equal(found.body.data.patient.blood_group, "");
    assert.equal(found.body.data.visits.length, 2);
    assert.equal(found.body.data.multiple, false);
  });

  it("GET /api/v1/patients/lookup/ finds returning patients by Patient ID", async () => {
    const found = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ patient_id: waitingId })
      .set(deskAuth());
    assert.equal(found.status, 200);
    assert.equal(found.body.data.found, true);
    assert.equal(found.body.data.patient_id, waitingId);
    assert.equal(found.body.data.mobile, mobileA);

    const byQ = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ q: waitingId })
      .set(deskAuth());
    assert.equal(byQ.body.data.found, true);
    assert.equal(byQ.body.data.patient_id, waitingId);
  });

  it("GET /api/v1/patients/lookup/ finds a returning patient by name", async () => {
    const soloName = `Node Lookup Solo ${stamp}`;
    const soloMobile = `63${String(Date.now()).slice(-8)}`;
    const created = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: soloName,
        mobile: soloMobile,
        age: 22,
        gender: "MALE",
        chief_complaint: "Solo lookup",
      });
    assert.equal(created.status, 201);
    const soloId = trackPatient(created.body.data.patient.id);

    const found = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ patient_name: soloName })
      .set(deskAuth());
    assert.equal(found.status, 200);
    assert.equal(found.body.message, "Returning patient found.");
    assert.equal(found.body.data.found, true);
    assert.equal(found.body.data.multiple, false);
    assert.equal(found.body.data.patient_id, soloId);
    assert.equal(found.body.data.mobile, soloMobile);
    assert.ok(!found.body.data.matches);

    const byQ = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ q: soloName })
      .set(deskAuth());
    assert.equal(byQ.body.data.found, true);
    assert.equal(byQ.body.data.patient_id, soloId);
  });

  it("GET /api/v1/patients/lookup/ combined mobile and name requires both to match", async () => {
    const found = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ mobile: mobileA, patient_name: "Alpha" })
      .set(deskAuth());
    assert.equal(found.status, 200);
    assert.equal(found.body.data.found, true);
    assert.equal(found.body.data.multiple, false);
    assert.equal(found.body.data.patient_id, waitingId);

    const mismatch = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ mobile: mobileA, patient_name: "No Such Combined Name" })
      .set(deskAuth());
    assert.equal(mismatch.status, 200);
    assert.equal(mismatch.body.data.found, false);
    assert.equal(mismatch.body.data.mobile, mobileA);
    assert.equal(mismatch.body.data.patient_name, "No Such Combined Name");
    assert.equal(mismatch.body.data.visit_count, 0);
    assert.ok(!mismatch.body.data.patient);
  });

  it("GET /api/v1/patients/lookup/ returns a selectable list when multiple names match", async () => {
    const twinName = `Node Lookup Twin ${stamp}`;
    const mobileTwin1 = `61${String(Date.now()).slice(-8)}`;
    const mobileTwin2 = `62${String(Date.now()).slice(-8)}`;

    const first = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: twinName,
        mobile: mobileTwin1,
        age: 28,
        gender: "MALE",
        chief_complaint: "Twin one",
      });
    const second = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: twinName,
        mobile: mobileTwin2,
        age: 31,
        gender: "FEMALE",
        chief_complaint: "Twin two",
      });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const firstId = trackPatient(first.body.data.patient.id);
    const secondId = trackPatient(second.body.data.patient.id);

    const listed = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ patient_name: twinName })
      .set(deskAuth());
    assert.equal(listed.status, 200);
    assert.equal(listed.body.message, "Multiple patients found. Select a patient to continue.");
    assert.equal(listed.body.data.found, true);
    assert.equal(listed.body.data.multiple, true);
    assert.equal(listed.body.data.match_count, 2);
    assert.equal(listed.body.data.patient, undefined);
    assert.equal(listed.body.data.patient_id, undefined);
    assert.equal(listed.body.data.visits, undefined);

    const matches = listed.body.data.matches as Array<{
      patient_id: string;
      patient_name: string;
      mobile_masked: string;
      last_visit: string | null;
    }>;
    assert.equal(matches.length, 2);
    const ids = matches.map((row) => row.patient_id).sort();
    assert.deepEqual(ids, [firstId, secondId].sort());
    for (const row of matches) {
      assert.equal(row.patient_name, twinName);
      assert.ok(row.mobile_masked.includes("*"));
      assert.ok(!row.mobile_masked.includes(mobileTwin1));
      assert.ok(!row.mobile_masked.includes(mobileTwin2));
      assert.ok(row.last_visit);
    }

    const selected = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ patient_id: firstId })
      .set(deskAuth());
    assert.equal(selected.body.data.found, true);
    assert.equal(selected.body.data.multiple, false);
    assert.equal(selected.body.data.patient_id, firstId);
    assert.equal(selected.body.data.next_visit_number, 2);
  });

  it("GET /api/v1/patients/lookup/ returns no results for an unknown name", async () => {
    const missingName = `No Such Patient ${stamp}`;
    const none = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ patient_name: missingName })
      .set(deskAuth());
    assert.equal(none.status, 200);
    assert.equal(none.body.message, "No previous visits found for this patient name.");
    assert.deepEqual(none.body.data, {
      found: false,
      patient_name: missingName,
      visit_count: 0,
      next_visit_number: 1,
    });
  });

  it("returning-patient workflow keeps Patient ID, increments visit, issues a new token", async () => {
    const mobile = `8${String(Date.now()).slice(-9)}`;
    const first = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: "Node Return One",
        mobile,
        age: 41,
        gender: "MALE",
        chief_complaint: "First visit",
      });
    assert.equal(first.status, 201);
    const firstVisit = first.body.data.patient;
    trackPatient(firstVisit.id);
    assert.equal(firstVisit.visit_number, 1);
    assert.equal(firstVisit.patient_id, firstVisit.id);
    assert.match(firstVisit.token_number, /^P\d{4}$/);

    const lookup = await request(app)
      .get("/api/v1/patients/lookup/")
      .query({ mobile })
      .set(deskAuth());
    assert.equal(lookup.body.data.found, true);
    assert.equal(lookup.body.data.patient_id, firstVisit.patient_id);
    assert.equal(lookup.body.data.next_visit_number, 2);

    const second = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: "Node Return One",
        mobile,
        age: 41,
        gender: "MALE",
        chief_complaint: "Follow-up visit",
        patient_id: firstVisit.patient_id,
      });
    assert.equal(second.status, 201);
    const secondVisit = second.body.data.patient;
    trackPatient(secondVisit.id);

    assert.equal(secondVisit.patient_id, firstVisit.patient_id);
    assert.notEqual(secondVisit.id, firstVisit.id);
    assert.equal(secondVisit.visit_number, 2);
    assert.match(secondVisit.token_number, /^P\d{4}$/);
    assert.notEqual(secondVisit.token_number, firstVisit.token_number);

    const storedFirst = await Patient.findById(firstVisit.id).exec();
    const storedSecond = await Patient.findById(secondVisit.id).exec();
    assert.ok(storedFirst && storedSecond);
    assert.equal(storedFirst.patient_id, storedSecond.patient_id);
    assert.notEqual(storedFirst.token_number, storedSecond.token_number);
  });

  it("GET /api/v1/patients/stats/ returns Django stat keys", async () => {
    const before = await request(app).get("/api/v1/patients/stats/").set(deskAuth());
    assert.equal(before.status, 200);
    assert.equal(before.body.message, "Patient stats retrieved successfully.");
    for (const key of ["waiting", "in_consultation", "completed", "completed_today", "today"]) {
      assert.equal(typeof before.body.data[key], "number");
    }

    const created = await request(app)
      .post("/api/v1/patients/")
      .set(deskAuth())
      .send({
        patient_name: "Node Pat Stats",
        mobile: `${mobileA}1`.slice(0, 20),
        age: 20,
        gender: "MALE",
        chief_complaint: "Cough",
      });
    trackPatient(created.body.data.patient.id);

    const after = await request(app).get("/api/v1/patients/stats/").set(deskAuth());
    assert.equal(after.body.data.today, before.body.data.today + 1);
    assert.equal(after.body.data.waiting, before.body.data.waiting + 1);
  });

  it("GET /api/v1/patients/<pk>/ returns a patient and 404s unknown ids", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${waitingId}/`)
      .set(deskAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Patient retrieved successfully.");
    assert.equal(res.body.data.patient.id, waitingId);

    const missing = await request(app)
      .get("/api/v1/patients/aaaaaaaaaaaaaaaaaaaaaaaa/")
      .set(deskAuth());
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      success: false,
      message: "Patient not found.",
    });
  });

  it("GET /api/v1/patients/<pk>/ falls back to patient_id when the visit _id is gone", async () => {
    const first = await Patient.create({
      token_number: `n${Date.now().toString(36)}`.slice(0, 20),
      visit_number: 1,
      patient_name: `${stamp} identity-first`,
      mobile: `${mobileA.slice(0, 9)}7`,
      age: 33,
      gender: "FEMALE",
      chief_complaint: "Follow up",
      status: "COMPLETED",
      created_by: adminId,
    });
    createdPatientIds.push(String(first._id));
    const later = await Patient.create({
      token_number: `n${(Date.now() + 1).toString(36)}`.slice(0, 20),
      visit_number: 2,
      patient_id: String(first._id),
      patient_name: `${stamp} identity-later`,
      mobile: `${mobileA.slice(0, 9)}7`,
      age: 33,
      gender: "FEMALE",
      chief_complaint: "Follow up",
      status: "WAITING",
      created_by: adminId,
    });
    createdPatientIds.push(String(later._id));
    await Patient.deleteOne({ _id: first._id });

    const res = await request(app)
      .get(`/api/v1/patients/${String(first._id)}/`)
      .set(deskAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.data.patient.id, String(later._id));
    assert.equal(res.body.data.patient.patient_id, String(first._id));
    assert.equal(res.body.data.patient.visit_number, 2);
  });

  it("PUT /api/v1/patients/<pk>/ is partial; receptionist cannot edit after consultation starts", async () => {
    const updated = await request(app)
      .put(`/api/v1/patients/${waitingId}/`)
      .set(deskAuth())
      .send({ patient_name: "  Node Pat Renamed  " });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.patient.patient_name, "Node Pat Renamed");
    assert.equal(updated.body.data.patient.visit_number, 1);
    assert.equal(updated.body.data.patient.mobile, mobileA);

    const inConsult = await Patient.create({
      token_number: `n${Date.now().toString(36)}`.slice(0, 20),
      visit_number: 1,
      patient_name: "Node Pat In Consult",
      mobile: `${mobileA.slice(0, 9)}2`,
      age: 40,
      gender: "MALE",
      chief_complaint: "Pain",
      status: "IN_CONSULTATION",
      created_by: adminId,
      created_by_name: "Node Pat Admin",
    });
    inConsultId = trackPatient(String(inConsult._id));

    const blocked = await request(app)
      .put(`/api/v1/patients/${inConsultId}/`)
      .set(deskAuth())
      .send({ patient_name: "Should Fail" });
    assert.equal(blocked.status, 400);
    assert.equal(
      blocked.body.message,
      "Patient registration cannot be edited after consultation has started.",
    );
    assert.deepEqual(blocked.body.errors, {
      non_field_errors: [
        "Patient registration cannot be edited after consultation has started.",
      ],
    });

    const adminEdit = await request(app)
      .put(`/api/v1/patients/${inConsultId}/`)
      .set(adminAuth())
      .send({ patient_name: "Admin Edited" });
    assert.equal(adminEdit.status, 200);
    assert.equal(adminEdit.body.data.patient.patient_name, "Admin Edited");
    assert.equal(adminEdit.body.data.patient.status, "IN_CONSULTATION");
  });

  it("DELETE /api/v1/patients/<pk>/ is admin-only hard delete", async () => {
    const forbidden = await request(app)
      .delete(`/api/v1/patients/${inConsultId}/`)
      .set(deskAuth());
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, {
      detail: "Only administrators can delete patients.",
    });

    const deleted = await request(app)
      .delete(`/api/v1/patients/${inConsultId}/`)
      .set(adminAuth());
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, {
      success: true,
      message: "Patient deleted successfully.",
    });
    assert.equal(await Patient.findById(inConsultId).exec(), null);
  });

  it("serializes an existing MongoDB patient without changing it", async () => {
    const existing = await Patient.findOne({
      _id: { $nin: createdPatientIds },
    }).exec();
    if (!existing) {
      const ours = await Patient.findById(waitingId).lean().exec();
      assert.ok(ours);
      assert.equal(typeof ours.patient_name, "string");
      assert.equal(typeof ours.token_number, "string");
      return;
    }

    const rawBefore = await Patient.collection.findOne({ _id: existing._id });
    const res = await request(app)
      .get(`/api/v1/patients/${String(existing._id)}/`)
      .set(adminAuth());
    const rawAfter = await Patient.collection.findOne({ _id: existing._id });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.patient.id, String(existing._id));
    assert.equal(res.body.data.patient.patient_name, existing.patient_name);
    assert.match(String(res.body.data.patient.token_number), /^P?\w+/);
    assert.equal("password" in res.body.data.patient, false);
    assert.deepEqual(rawAfter, rawBefore);
  });
});
