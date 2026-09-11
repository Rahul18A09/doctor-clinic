import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBedPatientSearchOrClauses,
  buildRoomListSearchFilter,
} from "../../src/beds/roomSearch";

describe("buildBedPatientSearchOrClauses", () => {
  it("matches phone numbers against mobile only", () => {
    assert.deepEqual(buildBedPatientSearchOrClauses("9033314141"), [
      { mobile: { $regex: "9033314141", $options: "i" } },
    ]);
  });

  it("matches names against patient_name only", () => {
    assert.deepEqual(buildBedPatientSearchOrClauses("Jay Sasani"), [
      { patient_name: { $regex: "Jay Sasani", $options: "i" } },
    ]);
  });

  it("does not treat token-like queries as patient search", () => {
    assert.deepEqual(buildBedPatientSearchOrClauses("01"), []);
    assert.deepEqual(buildBedPatientSearchOrClauses("03"), []);
    assert.deepEqual(buildBedPatientSearchOrClauses("P0003"), []);
  });
});

describe("buildRoomListSearchFilter", () => {
  it("always searches room_number and notes", () => {
    const filter = buildRoomListSearchFilter("101", []) as {
      $or: Record<string, unknown>[];
    };
    assert.equal(filter.$or.length, 2);
    assert.ok(filter.$or.some((clause) => "room_number" in clause));
    assert.ok(filter.$or.some((clause) => "notes" in clause));
  });

  it("includes matched room ids from beds or patients", () => {
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const filter = buildRoomListSearchFilter("A1", [id]) as {
      $or: Record<string, unknown>[];
    };
    assert.equal(filter.$or.length, 3);
    assert.ok(filter.$or.some((clause) => "_id" in clause));
  });
});
