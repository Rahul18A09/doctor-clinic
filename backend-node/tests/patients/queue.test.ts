import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { getTodayUtcRange, utcDatePrefix } from "../../src/http/utc";
import { Patient } from "../../src/models/patient.model";
import { getPublicQueueStatus } from "../../src/patients/queue";
import { formatTokenForDisplay } from "../../src/patients/tokens";

describe("getPublicQueueStatus", { timeout: 120_000 }, () => {
  const createdIds: string[] = [];
  const day = new Date("1999-06-15T12:00:00.000Z");
  const prefix = utcDatePrefix(day);
  let seq = Number(String(Date.now()).slice(-4));
  const stamp = `node.qalg.${Date.now()}`;

  before(async () => {
    await connectDatabase();
    const { start, end } = getTodayUtcRange(day);
    await Patient.deleteMany({ created_at: { $gte: start, $lt: end } });
  });

  after(async () => {
    if (createdIds.length > 0) {
      await Patient.deleteMany({ _id: { $in: createdIds } });
    }
    await disconnectDatabase();
  });

  function nextToken(): string {
    seq += 1;
    return `${prefix}-P${String(seq).padStart(4, "0")}`.slice(0, 20);
  }

  async function createPatient(overrides: Record<string, unknown> = {}) {
    const createdAt = (overrides["created_at"] as Date | undefined) ?? day;
    const patient = await Patient.create({
      token_number: nextToken(),
      visit_number: 1,
      patient_name: `${stamp} patient`,
      mobile: "8000000000",
      age: 30,
      gender: "MALE",
      chief_complaint: "Fever",
      status: "WAITING",
      created_by: "queue-test",
      created_by_name: "Queue Test",
      ...overrides,
      created_at: createdAt,
    });
    createdIds.push(String(patient._id));
    return patient;
  }

  it("returns empty strings when nobody was created on that UTC day", async () => {
    const status = await getPublicQueueStatus(day);
    assert.deepEqual(status, {
      todays_token: "",
      current_token: "",
      current_patient_name: "",
    });
  });

  it("uses the latest created patient as todays_token and the earliest WAITING as current", async () => {
    const first = await createPatient({
      patient_name: `${stamp} wait-first`,
      created_at: new Date("1999-06-15T08:00:00.000Z"),
    });
    const last = await createPatient({
      patient_name: `${stamp} wait-last`,
      created_at: new Date("1999-06-15T18:00:00.000Z"),
    });
    await createPatient({
      patient_name: `${stamp} yesterday`,
      created_at: new Date("1999-06-14T23:59:59.000Z"),
    });

    const status = await getPublicQueueStatus(day);
    assert.equal(status.todays_token, formatTokenForDisplay(last.token_number));
    assert.equal(status.current_token, formatTokenForDisplay(first.token_number));
    assert.equal(status.current_patient_name, `${stamp} wait-first`);
    assert.match(status.todays_token, /^P\d+$/);
    assert.equal(status.todays_token.includes("-"), false);
  });

  it("prefers IN_CONSULTATION over WAITING, earliest start first", async () => {
    await createPatient({
      patient_name: `${stamp} later-consult`,
      status: "IN_CONSULTATION",
      created_at: new Date("1999-06-15T09:00:00.000Z"),
      consultation_started_at: new Date("1999-06-15T11:00:00.000Z"),
    });
    const current = await createPatient({
      patient_name: `${stamp} earlier-consult`,
      status: "IN_CONSULTATION",
      created_at: new Date("1999-06-15T10:00:00.000Z"),
      consultation_started_at: new Date("1999-06-15T10:30:00.000Z"),
    });

    const status = await getPublicQueueStatus(day);
    assert.equal(status.current_token, formatTokenForDisplay(current.token_number));
    assert.equal(status.current_patient_name, `${stamp} earlier-consult`);
  });

  it("drops COMPLETED patients so the next WAITING becomes current", async () => {
    const nextWaiting = await createPatient({
      patient_name: `${stamp} next-waiting`,
      created_at: new Date("1999-06-15T07:30:00.000Z"),
    });
    const inConsult = await Patient.findOne({
      _id: { $in: createdIds },
      patient_name: `${stamp} earlier-consult`,
    }).exec();
    assert.ok(inConsult);
    inConsult.status = "COMPLETED";
    inConsult.consultation_completed_at = new Date("1999-06-15T12:00:00.000Z");
    inConsult.completed_at = inConsult.consultation_completed_at;
    await inConsult.save();

    const laterConsult = await Patient.findOne({
      _id: { $in: createdIds },
      patient_name: `${stamp} later-consult`,
    }).exec();
    assert.ok(laterConsult);
    laterConsult.status = "COMPLETED";
    laterConsult.consultation_completed_at = new Date("1999-06-15T12:05:00.000Z");
    await laterConsult.save();

    const status = await getPublicQueueStatus(day);
    assert.equal(status.current_token, formatTokenForDisplay(nextWaiting.token_number));
    assert.equal(status.current_patient_name, `${stamp} next-waiting`);
  });

  it("re-enters cancelled patients into WAITING in original created_at order", async () => {
    const cancelled = await createPatient({
      patient_name: `${stamp} cancelled-back`,
      status: "IN_CONSULTATION",
      created_at: new Date("1999-06-15T07:00:00.000Z"),
      consultation_started_at: new Date("1999-06-15T13:00:00.000Z"),
    });
    cancelled.status = "WAITING";
    cancelled.set("consultation_started_at", null);
    await cancelled.save();

    const status = await getPublicQueueStatus(day);
    assert.equal(status.current_token, formatTokenForDisplay(cancelled.token_number));
    assert.equal(status.current_patient_name, `${stamp} cancelled-back`);
    assert.notEqual(status.current_patient_name.includes("CANCELLED"), true);
  });
});
