import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientListFilter } from "../../src/patients/filters";
import { buildPatientSearchOrClauses, parseTokenSearchSequence } from "../../src/patients/search";

describe("parseTokenSearchSequence", () => {
  it("parses UI, API, and stored token forms", () => {
    assert.equal(parseTokenSearchSequence("01"), 1);
    assert.equal(parseTokenSearchSequence("03"), 3);
    assert.equal(parseTokenSearchSequence("0003"), 3);
    assert.equal(parseTokenSearchSequence("P0003"), 3);
    assert.equal(parseTokenSearchSequence("p12"), 12);
    assert.equal(parseTokenSearchSequence("20260911-P0003"), 3);
  });

  it("rejects phone-length digit strings and names", () => {
    assert.equal(parseTokenSearchSequence("9033314141"), null);
    assert.equal(parseTokenSearchSequence("Jay"), null);
    assert.equal(parseTokenSearchSequence(""), null);
  });
});

describe("buildPatientSearchOrClauses", () => {
  it("matches token search against padded token suffix only", () => {
    const clauses = buildPatientSearchOrClauses("03");
    assert.equal(clauses.length, 2);
    assert.deepEqual(clauses[0], {
      token_number: { $regex: "-P0003$", $options: "i" },
    });
    assert.deepEqual(clauses[1], {
      token_number: { $regex: "^P0003$", $options: "i" },
    });
  });

  it("matches phone search against mobile only", () => {
    assert.deepEqual(buildPatientSearchOrClauses("9033314141"), [
      { mobile: { $regex: "9033314141", $options: "i" } },
    ]);
  });

  it("matches name search against patient_name (and patient_id when enabled)", () => {
    assert.deepEqual(buildPatientSearchOrClauses("Jay"), [
      { patient_name: { $regex: "Jay", $options: "i" } },
    ]);
    const withId = buildPatientSearchOrClauses("Jay", { includePatientId: true });
    assert.equal(withId.length, 2);
    assert.ok(withId.some((clause) => "patient_id" in clause));
  });
});

describe("buildPatientListFilter", () => {
  const now = new Date("2026-08-19T13:00:00.000Z");

  it("uses token-only search for short display tokens like 01", () => {
    const filter = buildPatientListFilter({ search: "01" }, now) as {
      $or: Record<string, unknown>[];
    };
    assert.ok(filter.$or);
    assert.ok(filter.$or.every((clause) => "token_number" in clause));
    assert.ok(!filter.$or.some((clause) => "mobile" in clause));
  });

  it("searches patient_name and patient_id for free-text names", () => {
    const filter = buildPatientListFilter({ search: "Prem" }, now);
    assert.ok(filter["$or"]);
    const or = filter["$or"] as Record<string, unknown>[];
    assert.ok(or.some((clause) => "patient_name" in clause));
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
      admission_status: { $in: ["Pending", "Admission Required"] },
    });
    assert.deepEqual(buildPatientListFilter({ care_type: "Inpatient" }, now), {
      care_type: "Inpatient",
    });
    assert.deepEqual(buildPatientListFilter({ admission_status: "Admitted" }, now), {
      admission_status: "Admitted",
    });
    assert.deepEqual(buildPatientListFilter({ admission_status: "Pending" }, now), {
      admission_status: { $in: ["Pending", "Admission Required"] },
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

  it("combines token search with filter=today", () => {
    const filter = buildPatientListFilter({ search: "03", filter: "today" }, now) as {
      $and: Record<string, unknown>[];
    };
    assert.ok(Array.isArray(filter.$and));
    assert.equal(filter.$and.length, 2);
    assert.ok(filter.$and[0]?.["$or"]);
    assert.ok(filter.$and[1]?.["created_at"]);
  });
});
