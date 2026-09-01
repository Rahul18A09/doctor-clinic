import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { NotificationType, UserRole } from "../../src/constants";
import { Notification } from "../../src/models/notification.model";
import { Patient } from "../../src/models/patient.model";
import { Settings } from "../../src/models/settings.model";
import { User } from "../../src/models/user.model";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../../src/settings/defaults";
import { notifyStaff } from "../../src/notifications/notifyStaff";

const app = createApp();
const PASSWORD = "Notify-Test9x";

function accessFor(user: { _id: { toString(): string }; email: string; full_name: string; role: string }) {
  return generateAccessToken({
    user_id: String(user._id),
    email: user.email,
    full_name: user.full_name,
    role: user.role as UserRole,
  });
}

describe("notification API", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  const createdPatientIds: string[] = [];
  let stamp = "";
  let adminId = "";
  let receptionistId = "";
  let otherAdminId = "";
  let adminToken = "";
  let receptionistToken = "";
  let otherAdminToken = "";
  let adminNoteId = "";
  let receptionistNoteId = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.notify.${Date.now()}`;

    const admin = await User.create({
      full_name: "Notify Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    const receptionist = await User.create({
      full_name: "Notify Desk",
      email: `${stamp}.desk@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });
    const otherAdmin = await User.create({
      full_name: "Notify Other Admin",
      email: `${stamp}.other@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });

    adminId = String(admin._id);
    receptionistId = String(receptionist._id);
    otherAdminId = String(otherAdmin._id);
    createdUserIds.push(adminId, receptionistId, otherAdminId);
    adminToken = accessFor(admin);
    receptionistToken = accessFor(receptionist);
    otherAdminToken = accessFor(otherAdmin);

    const adminNote = await Notification.create({
      user_id: adminId,
      type: NotificationType.PATIENT,
      title: "New patient registered",
      message: "Rahul Patel was registered with token 0008.",
      is_read: false,
    });
    const receptionistNote = await Notification.create({
      user_id: receptionistId,
      type: NotificationType.PATIENT,
      title: "New patient registered",
      message: "Rahul Patel has been registered for visit #1 with token 0008.",
      is_read: false,
    });
    await Notification.create({
      user_id: adminId,
      type: NotificationType.SYSTEM,
      title: "Clinic settings updated",
      message: "Notification preferences were saved.",
      is_read: true,
      read_at: new Date(),
    });
    await Notification.create({
      user_id: receptionistId,
      type: NotificationType.STAFF,
      title: "Receptionist added",
      message: "Priya Shah has been added as a receptionist.",
      is_read: false,
    });
    await Notification.create({
      user_id: adminId,
      type: NotificationType.PATIENT,
      title: "New patient registered",
      message: "Node Return One has been registered with token 0001.",
      is_read: false,
    });
    await Notification.create({
      user_id: adminId,
      type: NotificationType.TOKEN,
      title: "Token 0002 assigned",
      message: "Node Lookup Twin node.pat.1787397312105 has been assigned token 0002 for today's consultation.",
      is_read: false,
    });
    adminNoteId = String(adminNote._id);
    receptionistNoteId = String(receptionistNote._id);
  });

  after(async () => {
    if (createdPatientIds.length > 0) {
      await Patient.deleteMany({ _id: { $in: createdPatientIds } });
    }
    await Notification.deleteMany({
      user_id: { $in: createdUserIds },
    });
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { notifications: DEFAULT_SETTINGS.notifications } },
      { upsert: true },
    );
    await disconnectDatabase();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/notifications/");
    assert.equal(res.status, 401);
    assert.equal(res.body.detail, "Authentication credentials were not provided.");
  });

  it("lists only the logged-in user's notifications", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Notifications retrieved successfully.");
    const ids = res.body.data.results.map((item: { id: string }) => item.id);
    assert.ok(ids.includes(adminNoteId));
    assert.ok(!ids.includes(receptionistNoteId));
    for (const item of res.body.data.results) {
      assert.equal(item.user_id, adminId);
    }
  });

  it("filters by type and is_read", async () => {
    const byType = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "patient" })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(byType.status, 200);
    assert.ok(byType.body.data.results.every((item: { type: string }) => item.type === "patient"));

    const unread = await request(app)
      .get("/api/v1/notifications/")
      .query({ is_read: "false" })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(unread.status, 200);
    assert.ok(unread.body.data.results.every((item: { is_read: boolean }) => item.is_read === false));
  });

  it("rejects invalid list filters", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "unknown" })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors?.type);
  });

  it("returns unread count for the logged-in user", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/unread-count/")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.unread_count, "number");
    assert.ok(res.body.data.unread_count >= 1);
  });

  it("marks one owned notification as read", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${adminNoteId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Notification marked as read.");
    assert.equal(res.body.data.notification.is_read, true);
    assert.ok(res.body.data.notification.read_at);
  });

  it("does not let a user mark another user's notification as read", async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${receptionistNoteId}/read`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Notification not found.");
  });

  it("marks all owned notifications as read", async () => {
    await Notification.create({
      user_id: adminId,
      type: NotificationType.CONSULTATION,
      title: "Consultation completed",
      message: "Consultation for Rahul Patel (token 0008, visit #1) was completed on 22 Aug 2026, 4:30 pm.",
      is_read: false,
    });

    const res = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "All notifications marked as read.");
    assert.ok(res.body.data.updated >= 1);

    const count = await request(app)
      .get("/api/v1/notifications/unread-count/")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(count.body.data.unread_count, 0);

    const other = await request(app)
      .get("/api/v1/notifications/unread-count/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.ok(other.body.data.unread_count >= 1);
  });

  it("deletes an owned notification", async () => {
    const created = await Notification.create({
      user_id: receptionistId,
      type: NotificationType.TOKEN,
      title: "Queue update",
      message: "Token 0009 for Ankit Mehta is now in consultation.",
      is_read: false,
    });

    const res = await request(app)
      .delete(`/api/v1/notifications/${String(created._id)}`)
      .set("Authorization", `Bearer ${receptionistToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Notification deleted successfully.");
    const remaining = await Notification.findById(created._id).exec();
    assert.equal(remaining, null);
  });

  it("returns 404 for an invalid notification id", async () => {
    const res = await request(app)
      .delete("/api/v1/notifications/not-an-id")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Notification not found.");
  });

  it("lets a receptionist list their own notifications", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.results.some((item: { id: string }) => item.id === receptionistNoteId));
  });

  it("creates one combined notification for a new patient registration", async () => {
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          ...DEFAULT_SETTINGS,
          notifications: {
            patient_registration: true,
            token_generated: true,
            token_approaching: false,
            consultation_completed: false,
          },
        },
      },
      { upsert: true },
    );

    const before = await Notification.countDocuments({ user_id: otherAdminId }).exec();
    const mobile = `8${String(Date.now()).slice(-9)}`;
    const created = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        patient_name: "Rahul Patel",
        mobile,
        age: 32,
        gender: "FEMALE",
        chief_complaint: "Fever",
      });

    assert.equal(created.status, 201);
    createdPatientIds.push(created.body.data.patient.id);
    const token = String(created.body.data.patient.token_number ?? "").replace(/\D/g, "").padStart(4, "0");
    const patientId = created.body.data.patient.patient_id;

    const after = await Notification.find({ user_id: otherAdminId }).sort({ created_at: -1 }).exec();
    assert.equal(after.length, before + 1);
    assert.equal(after[0]?.type, NotificationType.QUEUE);
    assert.equal(after[0]?.title, "New patient waiting");
    assert.equal(
      after[0]?.message,
      `Rahul Patel is waiting for consultation (visit #1, token ${token}).`,
    );
    assert.equal(after[0]?.patient_name, "Rahul Patel");
    assert.equal(after[0]?.token_number, token);
    assert.equal(after[0]?.visit_number, 1);
    assert.equal(after.filter((row) => row.type === NotificationType.TOKEN).length, 0);
    assert.equal(after.filter((row) => row.type === NotificationType.PATIENT).length, 0);

    const queueList = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "queue" })
      .set("Authorization", `Bearer ${otherAdminToken}`);
    assert.equal(queueList.status, 200);
    assert.ok(queueList.body.data.results.some((item: { type: string; token_number?: string }) => item.type === "queue" && item.token_number === token));

    const deskQueue = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "queue" })
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(deskQueue.status, 200);
    assert.deepEqual(deskQueue.body.data.results, []);

    const deskNotes = await Notification.find({
      user_id: receptionistId,
      type: NotificationType.PATIENT,
      token_number: token,
    }).exec();
    assert.equal(deskNotes.length, 1);
    assert.equal(deskNotes[0]?.title, "New patient registered");
    assert.equal(
      deskNotes[0]?.message,
      `Rahul Patel has been registered for visit #1 with token ${token}.`,
    );

    const returning = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        patient_name: "Rahul Patel",
        mobile,
        age: 32,
        gender: "FEMALE",
        chief_complaint: "Follow-up",
        patient_id: patientId,
      });
    assert.equal(returning.status, 201);
    createdPatientIds.push(returning.body.data.patient.id);
    const returnToken = String(returning.body.data.patient.token_number ?? "")
      .replace(/\D/g, "")
      .padStart(4, "0");
    const visitNumber = returning.body.data.patient.visit_number;

    const afterReturn = await Notification.find({ user_id: otherAdminId }).sort({ created_at: -1 }).exec();
    assert.equal(afterReturn.length, before + 2);
    assert.equal(afterReturn[0]?.type, NotificationType.QUEUE);
    assert.equal(afterReturn[0]?.title, "Returning patient waiting");
    assert.equal(
      afterReturn[0]?.message,
      `Rahul Patel is waiting for consultation (visit #${visitNumber}, token ${returnToken}).`,
    );
    assert.equal(afterReturn[0]?.patient_name, "Rahul Patel");
    assert.equal(afterReturn[0]?.token_number, returnToken);
    assert.equal(afterReturn[0]?.visit_number, visitNumber);
  });

  it("does not create notifications for internal test patient names", async () => {
    const before = await Notification.countDocuments({ user_id: otherAdminId }).exec();
    const created = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        patient_name: "Node Lookup Twin node.pat.1787397312105",
        mobile: `7${String(Date.now()).slice(-9)}`,
        age: 28,
        gender: "MALE",
        chief_complaint: "Cough",
      });
    assert.equal(created.status, 201);
    createdPatientIds.push(created.body.data.patient.id);
    const after = await Notification.countDocuments({ user_id: otherAdminId }).exec();
    assert.equal(after, before);
  });

  it("hides internal test names from the inbox", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    const text = res.body.data.results
      .map((item: { title: string; message: string }) => `${item.title} ${item.message}`)
      .join(" ");
    assert.equal(text.includes("Node Return One"), false);
    assert.equal(text.includes("Node Lookup Twin"), false);
    assert.equal(text.includes("node.pat."), false);
    assert.equal(text.includes("Node Rcpt"), false);
  });

  it("does not show staff notifications to a receptionist", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.results.every((item: { type: string }) => item.type !== "staff"));
    assert.ok(res.body.data.results.every((item: { type: string }) => item.type !== "system"));
    assert.ok(res.body.data.results.every((item: { type: string }) => item.type !== "queue"));
  });

  it("returns an empty list when a receptionist filters by staff", async () => {
    const res = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "staff" })
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.results, []);
  });

  it("does not duplicate the same related event for a user", async () => {
    const relatedId = `pr:${stamp}`.slice(0, 64);
    const input = {
      type: NotificationType.PATIENT,
      title: "New patient registered",
      message: "Meera Shah has been registered for visit #1 with token 0009.",
      related_id: relatedId,
      patient_name: "Meera Shah",
      token_number: "0009",
      visit_number: 1,
      roles: [UserRole.RECEPTIONIST],
    };
    assert.ok((await notifyStaff(input)) >= 1);
    assert.equal(await notifyStaff(input), 0);
    assert.equal(await Notification.countDocuments({ user_id: receptionistId, related_id: relatedId }), 1);
  });

  it("creates a queue notification on waiting and removes it when consultation starts", async () => {
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          ...DEFAULT_SETTINGS,
          notifications: {
            patient_registration: true,
            token_generated: true,
            token_approaching: true,
            consultation_completed: true,
          },
        },
      },
      { upsert: true },
    );

    const created = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${receptionistToken}`)
      .send({
        patient_name: "Kiran Desai",
        mobile: `6${String(Date.now()).slice(-9)}`,
        age: 41,
        gender: "MALE",
        chief_complaint: "Headache",
      });
    assert.equal(created.status, 201);
    const patientId = created.body.data.patient.id as string;
    createdPatientIds.push(patientId);
    const token = String(created.body.data.patient.token_number ?? "").replace(/\D/g, "").padStart(4, "0");

    const waitingQueue = await Notification.find({
      user_id: adminId,
      type: NotificationType.QUEUE,
      token_number: token,
    }).exec();
    assert.equal(waitingQueue.length, 1);
    assert.equal(
      await Notification.countDocuments({
        user_id: receptionistId,
        type: NotificationType.QUEUE,
        token_number: token,
      }).exec(),
      0,
    );
    assert.equal(
      await Notification.countDocuments({
        user_id: adminId,
        type: NotificationType.PATIENT,
        token_number: token,
      }).exec(),
      0,
    );
    assert.equal(
      await Notification.countDocuments({
        user_id: adminId,
        type: NotificationType.TOKEN,
        token_number: token,
      }).exec(),
      0,
    );

    const queueList = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "queue" })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(queueList.status, 200);
    assert.ok(
      queueList.body.data.results.some(
        (item: { type: string; token_number?: string }) => item.type === "queue" && item.token_number === token,
      ),
    );

    const beforeDeskConsult = await Notification.countDocuments({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    }).exec();
    const beforeAdminConsult = await Notification.countDocuments({
      user_id: adminId,
      type: NotificationType.CONSULTATION,
    }).exec();

    const started = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/start/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(started.status, 200);
    assert.equal(
      await Notification.countDocuments({
        user_id: adminId,
        type: NotificationType.QUEUE,
        token_number: token,
      }).exec(),
      0,
    );

    const deskStarted = await Notification.find({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    })
      .sort({ created_at: -1 })
      .exec();
    assert.equal(deskStarted.length, beforeDeskConsult + 1);
    assert.equal(deskStarted[0]?.title, "Consultation started");
    assert.equal(deskStarted[0]?.patient_name, "Kiran Desai");
    assert.equal(deskStarted[0]?.token_number, token);
    assert.equal(
      await Notification.countDocuments({ user_id: adminId, type: NotificationType.CONSULTATION }).exec(),
      beforeAdminConsult,
    );

    const deskConsultList = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "consultation" })
      .set("Authorization", `Bearer ${receptionistToken}`);
    assert.equal(deskConsultList.status, 200);
    assert.ok(
      deskConsultList.body.data.results.some(
        (item: { title: string; token_number?: string }) =>
          item.title === "Consultation started" && item.token_number === token,
      ),
    );

    const completed = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/complete/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(completed.status, 200);

    const deskConsult = await Notification.find({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    })
      .sort({ created_at: -1 })
      .exec();
    assert.equal(deskConsult.length, beforeDeskConsult + 2);
    assert.equal(deskConsult[0]?.title, "Consultation completed");
    assert.equal(deskConsult[0]?.patient_name, "Kiran Desai");
    assert.equal(deskConsult[0]?.token_number, token);

    const adminConsult = await Notification.find({
      user_id: adminId,
      type: NotificationType.CONSULTATION,
    })
      .sort({ created_at: -1 })
      .exec();
    assert.equal(adminConsult.length, beforeAdminConsult + 1);
    assert.equal(adminConsult[0]?.title, "Consultation completed");

    const consultList = await request(app)
      .get("/api/v1/notifications/")
      .query({ type: "consultation" })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(consultList.status, 200);
    assert.ok(consultList.body.data.results.every((item: { type: string }) => item.type === "consultation"));
    assert.ok(consultList.body.data.results.some((item: { token_number?: string }) => item.token_number === token));
  });

  it("skips completed inbox rows when consultation_completed is disabled", async () => {
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          ...DEFAULT_SETTINGS,
          notifications: {
            patient_registration: true,
            token_generated: true,
            token_approaching: true,
            consultation_completed: false,
          },
        },
      },
      { upsert: true },
    );

    const created = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${receptionistToken}`)
      .send({
        patient_name: "Nisha Kapoor",
        mobile: `7${String(Date.now()).slice(-9)}`,
        age: 36,
        gender: "FEMALE",
        chief_complaint: "Fever",
      });
    assert.equal(created.status, 201);
    const patientId = created.body.data.patient.id as string;
    createdPatientIds.push(patientId);

    const beforeDeskConsult = await Notification.countDocuments({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    }).exec();
    const beforeAdminConsult = await Notification.countDocuments({
      user_id: adminId,
      type: NotificationType.CONSULTATION,
    }).exec();

    const started = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/start/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(started.status, 200);

    const completed = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/complete/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(completed.status, 200);

    const deskConsult = await Notification.find({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    })
      .sort({ created_at: -1 })
      .exec();
    assert.equal(deskConsult.length, beforeDeskConsult + 1);
    assert.equal(deskConsult[0]?.title, "Consultation started");
    assert.equal(deskConsult[0]?.patient_name, "Nisha Kapoor");
    assert.equal(
      await Notification.countDocuments({
        user_id: receptionistId,
        type: NotificationType.CONSULTATION,
        title: "Consultation completed",
        patient_name: "Nisha Kapoor",
      }).exec(),
      0,
    );
    assert.equal(
      await Notification.countDocuments({
        user_id: adminId,
        type: NotificationType.CONSULTATION,
        title: "Consultation completed",
        patient_name: "Nisha Kapoor",
      }).exec(),
      0,
    );
    assert.equal(
      await Notification.countDocuments({ user_id: adminId, type: NotificationType.CONSULTATION }).exec(),
      beforeAdminConsult,
    );
  });

  it("notifies consultation cancelled and recreates the waiting queue notification", async () => {
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          ...DEFAULT_SETTINGS,
          notifications: {
            patient_registration: true,
            token_generated: false,
            token_approaching: false,
            consultation_completed: false,
          },
        },
      },
      { upsert: true },
    );

    const created = await request(app)
      .post("/api/v1/patients/")
      .set("Authorization", `Bearer ${receptionistToken}`)
      .send({
        patient_name: "Ananya Sharma",
        mobile: `5${String(Date.now()).slice(-9)}`,
        age: 29,
        gender: "FEMALE",
        chief_complaint: "Cough",
      });
    assert.equal(created.status, 201);
    const patientId = created.body.data.patient.id as string;
    createdPatientIds.push(patientId);
    const token = String(created.body.data.patient.token_number ?? "").replace(/\D/g, "").padStart(4, "0");

    const beforeDesk = await Notification.countDocuments({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    }).exec();
    const beforeAdmin = await Notification.countDocuments({
      user_id: adminId,
      type: NotificationType.CONSULTATION,
    }).exec();

    const started = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/start/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(started.status, 200);
    assert.equal(
      await Notification.countDocuments({
        user_id: adminId,
        type: NotificationType.QUEUE,
        token_number: token,
      }).exec(),
      0,
    );

    const cancelled = await request(app)
      .post(`/api/v1/doctor/patients/${patientId}/cancel/`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(cancelled.status, 200);

    const deskNotes = await Notification.find({
      user_id: receptionistId,
      type: NotificationType.CONSULTATION,
    })
      .sort({ created_at: -1 })
      .exec();
    assert.equal(deskNotes.length, beforeDesk + 2);
    assert.equal(deskNotes[0]?.title, "Consultation cancelled");
    assert.equal(deskNotes[1]?.title, "Consultation started");
    assert.equal(deskNotes[0]?.patient_name, "Ananya Sharma");
    assert.equal(
      await Notification.countDocuments({ user_id: adminId, type: NotificationType.CONSULTATION }).exec(),
      beforeAdmin + 1,
    );
    const requeued = await Notification.find({
      user_id: adminId,
      type: NotificationType.QUEUE,
      token_number: token,
    }).exec();
    assert.equal(requeued.length, 1);
  });
});
