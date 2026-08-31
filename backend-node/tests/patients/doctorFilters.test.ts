import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PatientStatus } from "../../src/constants";
import { buildDoctorListFilter, doctorListSort } from "../../src/patients/doctorFilters";

describe("buildDoctorListFilter", () => {
  const now = new Date("2026-08-19T13:00:00.000Z");
  const todayRange = {
    created_at: {
      $gte: new Date("2026-08-19T00:00:00.000Z"),
      $lt: new Date("2026-08-20T00:00:00.000Z"),
    },
  };

  it("defaults to WAITING when status and filter are omitted", () => {
    assert.deepEqual(buildDoctorListFilter({}, now), { status: PatientStatus.WAITING });
  });

  it("defaults to WAITING when filter=waiting", () => {
    assert.deepEqual(buildDoctorListFilter({ filter: "waiting" }, now), {
      status: PatientStatus.WAITING,
    });
  });

  it("maps status=active to WAITING or IN_CONSULTATION", () => {
    assert.deepEqual(buildDoctorListFilter({ status: "active" }, now), {
      status: { $in: [PatientStatus.WAITING, PatientStatus.IN_CONSULTATION] },
    });
  });

  it("uses an exact CHOICES status, including unused CANCELLED", () => {
    assert.deepEqual(buildDoctorListFilter({ status: "COMPLETED" }, now), {
      status: PatientStatus.COMPLETED,
    });
    assert.deepEqual(buildDoctorListFilter({ status: "CANCELLED" }, now), {
      status: PatientStatus.CANCELLED,
    });
  });

  it("does not apply the waiting default when filter=today", () => {
    assert.deepEqual(buildDoctorListFilter({ filter: "today" }, now), todayRange);
  });

  it("applies UTC today on created_at for today=true/1/yes", () => {
    assert.deepEqual(buildDoctorListFilter({ today: "true" }, now), {
      $and: [{ status: PatientStatus.WAITING }, todayRange],
    });
    assert.deepEqual(buildDoctorListFilter({ today: "1", filter: "waiting" }, now), {
      $and: [{ status: PatientStatus.WAITING }, todayRange],
    });
    assert.deepEqual(buildDoctorListFilter({ today: "YES" }, now), {
      $and: [{ status: PatientStatus.WAITING }, todayRange],
    });
  });

  it("lets today=true win over filter=completed (no waiting default)", () => {
    assert.deepEqual(
      buildDoctorListFilter({ today: "true", filter: "completed" }, now),
      todayRange,
    );
  });

  it("maps filter=completed to COMPLETED all-time when today is unset", () => {
    assert.deepEqual(buildDoctorListFilter({ filter: "completed" }, now), {
      status: PatientStatus.COMPLETED,
    });
  });

  it("searches name, mobile, and stored token_number with waiting default", () => {
    const filter = buildDoctorListFilter({ search: "P0001" }, now) as {
      $and: Record<string, unknown>[];
    };
    assert.ok(filter.$and);
    assert.ok(filter.$and[0]?.["$or"]);
    assert.deepEqual(filter.$and[1], { status: PatientStatus.WAITING });
  });

  it("ignores unknown status and still defaults to WAITING", () => {
    assert.deepEqual(buildDoctorListFilter({ status: "nope" }, now), {
      status: PatientStatus.WAITING,
    });
  });
});

describe("doctorListSort", () => {
  it("sorts IN_CONSULTATION and COMPLETED by their timestamps, else created_at asc", () => {
    assert.deepEqual(doctorListSort("IN_CONSULTATION"), { consultation_started_at: -1 });
    assert.deepEqual(doctorListSort("COMPLETED"), { consultation_completed_at: -1 });
    assert.deepEqual(doctorListSort(""), { created_at: 1 });
    assert.deepEqual(doctorListSort("active"), { created_at: 1 });
    assert.deepEqual(doctorListSort("WAITING"), { created_at: 1 });
  });
});
