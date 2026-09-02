import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientListFilter } from "../../src/patients/filters";

describe("buildPatientListFilter", () => {
  const now = new Date("2026-08-19T13:00:00.000Z");

  it("searches name, mobile, stored token_number, and patient_id", () => {
    const filter = buildPatientListFilter({ search: "P0001" }, now);
    assert.ok(filter["$or"]);
    const or = filter["$or"] as Record<string, unknown>[];
    assert.ok(or.some((clause) => "patient_id" in clause));
  });

  it("uses status when it is a valid choice, ignoring filter=waiting", () => {
    const filter = buildPatientListFilter(
      { status: "COMPLETED", filter: "waiting" },
      now,
    );
    assert.deepEqual(filter, { status: "COMPLETED" });
  });

  it("maps filter=waiting and filter=completed when status is empty", () => {
    assert.deepEqual(buildPatientListFilter({ filter: "waiting" }, now), {
      status: "WAITING",
    });
    assert.deepEqual(buildPatientListFilter({ filter: "completed" }, now), {
      status: "COMPLETED",
    });
  });

  it("maps filter=admission_required and care_type/admission_status query params", async () => {
    assert.deepEqual(buildPatientListFilter({ filter: "admission_required" }, now), {
      admission_status: "Admission Required",
    });
    assert.deepEqual(buildPatientListFilter({ care_type: "Inpatient" }, now), {
      care_type: "Inpatient",
    });
    assert.deepEqual(buildPatientListFilter({ admission_status: "Admitted" }, now), {
      admission_status: "Admitted",
    });
    assert.deepEqual(buildPatientListFilter({ care_type: "Walk-in" }, now), {});
  });

  it("applies a valid date=YYYY-MM-DD as a UTC day on created_at", () => {
    const filter = buildPatientListFilter({ date: "2026-08-01" }, now) as {
      created_at: { $gte: Date; $lt: Date };
    };
    assert.equal(filter.created_at.$gte.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(filter.created_at.$lt.toISOString(), "2026-08-02T00:00:00.000Z");
  });

  it("ignores invalid date and does not fall through to today", () => {
    const filter = buildPatientListFilter(
      { date: "not-a-date", filter: "today" },
      now,
    );
    assert.deepEqual(filter, {});
  });

  it("uses UTC today when filter=today and date is omitted", () => {
    const filter = buildPatientListFilter({ filter: "today" }, now) as {
      created_at: { $gte: Date; $lt: Date };
    };
    assert.equal(filter.created_at.$gte.toISOString(), "2026-08-19T00:00:00.000Z");
    assert.equal(filter.created_at.$lt.toISOString(), "2026-08-20T00:00:00.000Z");
  });
});
