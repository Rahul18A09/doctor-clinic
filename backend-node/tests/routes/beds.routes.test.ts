import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { ensureBedManagementIndexes } from "../../src/beds/indexes";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { Bed } from "../../src/models/bed.model";
import { Notification } from "../../src/models/notification.model";
import { Patient } from "../../src/models/patient.model";
import { Room } from "../../src/models/room.model";
import { User } from "../../src/models/user.model";

const app = createApp();
const PASSWORD = "Beds-Test9x";

describe("bed management API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdRoomIds: string[] = [];
  const createdBedIds: string[] = [];
  const createdPatientIds: string[] = [];
  let stamp = "";
  let adminToken = "";
  let receptionistToken = "";
  let adminId = "";
  let receptionistId = "";

  before(async () => {
    await connectDatabase();
    await ensureBedManagementIndexes();
    stamp = `node.beds.${Date.now()}`;

    const admin = await User.create({
      full_name: "Beds Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    const desk = await User.create({
      full_name: "Beds Desk",
      email: `${stamp}.desk@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    adminId = String(admin._id);
    receptionistId = String(desk._id);
    createdUserIds.push(adminId, receptionistId);
    adminToken = generateAccessToken({
      user_id: adminId,
      email: admin.email,
      full_name: admin.full_name,
      role: "ADMIN",
    });
    receptionistToken = generateAccessToken({
      user_id: receptionistId,
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
      await Notification.deleteMany({ user_id: { $in: createdUserIds } });
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

  function trackRoom(id: string): string {
    createdRoomIds.push(id);
    return id;
  }

  function trackBed(id: string): string {
    createdBedIds.push(id);
    return id;
  }

  async function createPatient(name: string) {
    const patient = await Patient.create({
      token_number: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20),
      visit_number: 1,
      patient_name: name,
      mobile: `9${String(Date.now()).slice(-9)}`,
      age: 40,
      gender: "MALE",
      chief_complaint: "Admission",
      status: "WAITING",
      created_by: adminId,
    });
    createdPatientIds.push(String(patient._id));
    return String(patient._id);
  }

  async function createInpatient(name: string) {
    const id = await createPatient(name);
    await Patient.findByIdAndUpdate(id, {
      care_type: "Inpatient",
      admission_status: "Admission Required",
    }).exec();
    return id;
  }

  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/rooms/");
    assert.equal(res.status, 401);
  });

  it("lets admin create rooms and receptionist list them", async () => {
    const created = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-101`,
      room_type: "GENERAL",
      floor: "1",
      capacity: 2,
      notes: "General ward",
    });
    assert.equal(created.status, 201);
    const roomId = trackRoom(created.body.data.room.id);
    assert.equal(created.body.data.room.available_count, 0);
    assert.equal(created.body.data.room.bed_count, 0);

    const deskList = await request(app).get("/api/v1/rooms/").query({ search: stamp }).set(deskAuth());
    assert.equal(deskList.status, 200);
    assert.ok(deskList.body.data.results.some((row: { id: string }) => row.id === roomId));
  });

  it("rejects invalid room payloads", async () => {
    const res = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: "",
      room_type: "PENTHOUSE",
      capacity: 0,
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.room_number);
    assert.ok(res.body.errors.room_type);
    assert.ok(res.body.errors.floor);
    assert.ok(res.body.errors.capacity);
  });

  it("returns room details with beds and computed availability", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-201`,
      room_type: "PRIVATE",
      floor: "2",
      capacity: 2,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const bedA = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "A",
    });
    const bedB = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "B",
      status: "maintenance",
    });
    assert.equal(bedA.status, 201);
    assert.equal(bedB.status, 201);
    trackBed(bedA.body.data.bed.id);
    trackBed(bedB.body.data.bed.id);

    const detail = await request(app).get(`/api/v1/rooms/${roomId}/`).set(adminAuth());
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.room.bed_count, 2);
    assert.equal(detail.body.data.room.available_count, 1);
    assert.equal(detail.body.data.beds.length, 2);
  });

  it("does not create a bed past room capacity", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-cap`,
      room_type: "ICU",
      floor: "3",
      capacity: 1,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const first = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "1",
    });
    assert.equal(first.status, 201);
    trackBed(first.body.data.bed.id);
    const second = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "2",
    });
    assert.equal(second.status, 400);
    assert.equal(second.body.message, "This room has no remaining bed capacity.");
  });

  it("assigns an available bed, blocks occupied/maintenance/blocked, and prevents two active beds per patient", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-assign`,
      room_type: "WARD",
      floor: "1",
      capacity: 4,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const available = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "AV",
    });
    const reserved = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "RV",
      status: "reserved",
    });
    const maintenance = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "MN",
      status: "maintenance",
    });
    const blocked = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "BL",
      status: "blocked",
    });
    const availableId = trackBed(available.body.data.bed.id);
    const reservedId = trackBed(reserved.body.data.bed.id);
    const maintenanceId = trackBed(maintenance.body.data.bed.id);
    const blockedId = trackBed(blocked.body.data.bed.id);
    const patientA = await createInpatient(`${stamp} patient A`);
    const patientB = await createInpatient(`${stamp} patient B`);

    const assigned = await request(app)
      .post(`/api/v1/beds/${availableId}/assign/`)
      .set(deskAuth())
      .send({ patient_id: patientA });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.bed.status, "occupied");
    assert.equal(assigned.body.data.bed.patient_id, patientA);
    assert.ok(assigned.body.data.bed.assigned_at);

    const secondBed = await request(app)
      .post(`/api/v1/beds/${reservedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: patientB });
    assert.equal(secondBed.status, 400);
    assert.equal(secondBed.body.message, "Only available beds can be assigned.");

    const alreadyAssigned = await request(app)
      .post(`/api/v1/beds/${reservedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: patientA });
    assert.equal(alreadyAssigned.status, 400);
    assert.equal(alreadyAssigned.body.message, "This patient is already assigned to another bed.");

    const occupyAgain = await request(app)
      .post(`/api/v1/beds/${availableId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: patientB });
    assert.equal(occupyAgain.status, 400);
    assert.equal(occupyAgain.body.message, "Only available beds can be assigned.");

    const maint = await request(app)
      .post(`/api/v1/beds/${maintenanceId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: patientB });
    assert.equal(maint.status, 400);
    const blockedAssign = await request(app)
      .post(`/api/v1/beds/${blockedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: patientB });
    assert.equal(blockedAssign.status, 400);

    const missingPatient = await request(app)
      .post(`/api/v1/beds/${reservedId}/assign/`)
      .set(adminAuth())
      .send({ patient_id: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    assert.equal(missingPatient.status, 404);

    const invalidBed = await request(app)
      .post("/api/v1/beds/not-an-id/assign/")
      .set(adminAuth())
      .send({ patient_id: patientB });
    assert.equal(invalidBed.status, 404);
  });

  it("releases a bed and recalculates summary from statuses", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-sum`,
      room_type: "GENERAL",
      floor: "1",
      capacity: 2,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "S1",
    });
    const bedId = trackBed(bed.body.data.bed.id);
    const patientId = await createInpatient(`${stamp} summary`);
    await request(app).post(`/api/v1/beds/${bedId}/assign/`).set(adminAuth()).send({ patient_id: patientId });

    const occupiedSummary = await request(app).get("/api/v1/beds/summary/").set(deskAuth());
    assert.equal(occupiedSummary.status, 200);
    assert.ok(occupiedSummary.body.data.summary.total >= 1);
    assert.ok(occupiedSummary.body.data.summary.occupied >= 1);

    const released = await request(app).post(`/api/v1/beds/${bedId}/release/`).set(deskAuth());
    assert.equal(released.status, 200);
    assert.equal(released.body.data.bed.status, "available");
    assert.equal(released.body.data.bed.patient_id, null);

    const available = await request(app).get("/api/v1/beds/available/").query({ room_id: roomId }).set(adminAuth());
    assert.equal(available.status, 200);
    assert.ok(available.body.data.results.some((row: { id: string }) => row.id === bedId));
  });

  it("updates bed status except occupied shortcuts", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-st`,
      room_type: "OTHER",
      floor: "G",
      capacity: 1,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "ST",
    });
    const bedId = trackBed(bed.body.data.bed.id);
    const patientId = await createInpatient(`${stamp} status`);
    await request(app).post(`/api/v1/beds/${bedId}/assign/`).set(adminAuth()).send({ patient_id: patientId });

    const occupiedPatch = await request(app)
      .patch(`/api/v1/beds/${bedId}/status/`)
      .set(adminAuth())
      .send({ status: "maintenance" });
    assert.equal(occupiedPatch.status, 400);

    await request(app).post(`/api/v1/beds/${bedId}/release/`).set(adminAuth());
    const patched = await request(app)
      .patch(`/api/v1/beds/${bedId}/status/`)
      .set(adminAuth())
      .send({ status: "blocked" });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.bed.status, "blocked");

    const occupyViaStatus = await request(app)
      .patch(`/api/v1/beds/${bedId}/status/`)
      .set(adminAuth())
      .send({ status: "occupied" });
    assert.equal(occupyViaStatus.status, 400);
  });

  it("does not delete occupied beds or rooms with active occupancy", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-del`,
      room_type: "GENERAL",
      floor: "1",
      capacity: 1,
    });
    const roomId = trackRoom(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "D1",
    });
    const bedId = trackBed(bed.body.data.bed.id);
    const patientId = await createInpatient(`${stamp} delete`);
    await request(app).post(`/api/v1/beds/${bedId}/assign/`).set(adminAuth()).send({ patient_id: patientId });

    const deleteBed = await request(app).delete(`/api/v1/beds/${bedId}/`).set(adminAuth());
    assert.equal(deleteBed.status, 400);
    const deleteRoom = await request(app).delete(`/api/v1/rooms/${roomId}/`).set(adminAuth());
    assert.equal(deleteRoom.status, 400);

    await request(app).post(`/api/v1/beds/${bedId}/release/`).set(adminAuth());
    const deletedBed = await request(app).delete(`/api/v1/beds/${bedId}/`).set(adminAuth());
    assert.equal(deletedBed.status, 200);
    const deletedRoom = await request(app).delete(`/api/v1/rooms/${roomId}/`).set(adminAuth());
    assert.equal(deletedRoom.status, 200);
  });

  it("forbids receptionist from room and bed inventory mutations", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `${stamp}-perm`,
      room_type: "GENERAL",
      floor: "1",
      capacity: 2,
    });
    assert.equal(room.status, 201);
    const roomId = trackRoom(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "P1",
    });
    assert.equal(bed.status, 201);
    const bedId = trackBed(bed.body.data.bed.id);

    const forbidden = [
      await request(app).post("/api/v1/rooms/").set(deskAuth()).send({
        room_number: `${stamp}-desk`,
        room_type: "WARD",
        floor: "1",
        capacity: 1,
      }),
      await request(app).put(`/api/v1/rooms/${roomId}/`).set(deskAuth()).send({ notes: "no" }),
      await request(app).delete(`/api/v1/rooms/${roomId}/`).set(deskAuth()),
      await request(app).post("/api/v1/beds/").set(deskAuth()).send({
        room_id: roomId,
        bed_number: "P2",
      }),
      await request(app).put(`/api/v1/beds/${bedId}/`).set(deskAuth()).send({ bed_number: "PX" }),
      await request(app).delete(`/api/v1/beds/${bedId}/`).set(deskAuth()),
      await request(app)
        .patch(`/api/v1/beds/${bedId}/status/`)
        .set(deskAuth())
        .send({ status: "blocked" }),
    ];
    for (const res of forbidden) {
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, { detail: "Only administrators can manage rooms and beds." });
    }

    const listRooms = await request(app).get("/api/v1/rooms/").query({ search: stamp }).set(deskAuth());
    const getRoom = await request(app).get(`/api/v1/rooms/${roomId}/`).set(deskAuth());
    const listBeds = await request(app).get("/api/v1/beds/").query({ room_id: roomId }).set(deskAuth());
    const getBed = await request(app).get(`/api/v1/beds/${bedId}/`).set(deskAuth());
    const available = await request(app).get("/api/v1/beds/available/").query({ room_id: roomId }).set(deskAuth());
    const summary = await request(app).get("/api/v1/beds/summary/").set(deskAuth());
    assert.equal(listRooms.status, 200);
    assert.equal(getRoom.status, 200);
    assert.equal(listBeds.status, 200);
    assert.equal(getBed.status, 200);
    assert.equal(available.status, 200);
    assert.equal(summary.status, 200);
    assert.ok(available.body.data.results.some((row: { id: string }) => row.id === bedId));
  });

  it("filters beds by patient_id and notifies on assign, release, and maintenance", async () => {
    const room = await request(app).post("/api/v1/rooms/").set(adminAuth()).send({
      room_number: `Ward-${Math.random().toString(36).slice(2, 8)}`,
      room_type: "GENERAL",
      floor: "1",
      capacity: 2,
    });
    assert.equal(room.status, 201);
    const roomId = trackRoom(room.body.data.room.id);
    const bed = await request(app).post("/api/v1/beds/").set(adminAuth()).send({
      room_id: roomId,
      bed_number: "A1",
    });
    assert.equal(bed.status, 201);
    const bedId = trackBed(bed.body.data.bed.id);
    const patient = await Patient.create({
      token_number: `P${String(1000 + createdPatientIds.length).padStart(4, "0")}${String(Date.now()).slice(-2)}`,
      visit_number: 1,
      patient_name: "Ananya Rao",
      mobile: `9${String(Date.now()).slice(-9)}`,
      age: 34,
      gender: "FEMALE",
      chief_complaint: "Admission",
      status: "WAITING",
      created_by: adminId,
    });
    const patientId = String(patient._id);
    createdPatientIds.push(patientId);

    const invalidPatient = await request(app)
      .get("/api/v1/beds/")
      .query({ patient_id: "not-an-id" })
      .set(deskAuth());
    assert.equal(invalidPatient.status, 400);
    assert.deepEqual(invalidPatient.body.errors.patient_id, ["Enter a valid patient id."]);

    const outpatientAssign = await request(app)
      .post(`/api/v1/beds/${bedId}/assign/`)
      .set(deskAuth())
      .send({ patient_id: patientId });
    assert.equal(outpatientAssign.status, 400);
    assert.equal(
      outpatientAssign.body.message,
      "Only inpatients who require admission can be assigned a bed.",
    );

    await Patient.findByIdAndUpdate(patientId, {
      care_type: "Inpatient",
      admission_status: "Admission Required",
    }).exec();

    const assigned = await request(app)
      .post(`/api/v1/beds/${bedId}/assign/`)
      .set(deskAuth())
      .send({ patient_id: patientId });
    assert.equal(assigned.status, 200);

    const listed = await request(app)
      .get("/api/v1/beds/")
      .query({ patient_id: patientId })
      .set(deskAuth());
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.results.length, 1);
    assert.equal(listed.body.data.results[0].id, bedId);
    assert.equal(listed.body.data.results[0].status, "occupied");

    const assignedNotes = await Notification.find({
      title: "Bed assigned",
      related_id: new RegExp(`^ba:${patientId}`),
    }).exec();
    assert.ok(assignedNotes.some((row) => row.user_id === adminId));
    assert.ok(assignedNotes.some((row) => row.user_id === receptionistId));
    assert.equal(assignedNotes[0]?.type, "patient");

    const released = await request(app).post(`/api/v1/beds/${bedId}/release/`).set(adminAuth());
    assert.equal(released.status, 200);
    const afterRelease = await request(app)
      .get("/api/v1/beds/")
      .query({ patient_id: patientId })
      .set(adminAuth());
    assert.equal(afterRelease.body.data.results.length, 0);

    const releasedNotes = await Notification.find({
      title: "Bed released",
      related_id: new RegExp(`^br:${patientId}`),
    }).exec();
    assert.ok(releasedNotes.length >= 1);

    const patched = await request(app)
      .patch(`/api/v1/beds/${bedId}/status/`)
      .set(adminAuth())
      .send({ status: "maintenance" });
    assert.equal(patched.status, 200);
    const maintAssign = await request(app)
      .post(`/api/v1/beds/${bedId}/assign/`)
      .set(deskAuth())
      .send({ patient_id: patientId });
    assert.equal(maintAssign.status, 400);

    const maintNotes = await Notification.find({
      title: "Bed marked for maintenance",
      related_id: `bm:${bedId}`,
    }).exec();
    assert.ok(maintNotes.some((row) => row.user_id === adminId && row.type === "staff"));
    assert.equal(
      maintNotes.filter((row) => row.user_id === receptionistId).length,
      0,
    );
  });

  it("404s unknown room and bed ids", async () => {
    const room = await request(app)
      .get("/api/v1/rooms/aaaaaaaaaaaaaaaaaaaaaaaa/")
      .set(adminAuth());
    assert.equal(room.status, 404);
    const bed = await request(app)
      .get("/api/v1/beds/aaaaaaaaaaaaaaaaaaaaaaaa/")
      .set(adminAuth());
    assert.equal(bed.status, 404);
  });
});
