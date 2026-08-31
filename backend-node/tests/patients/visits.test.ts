import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyLookupQuery, maskMobile, permanentPatientId } from "../../src/patients/visits";

describe("classifyLookupQuery", () => {
  it("treats a 24-char ObjectId as Patient ID", () => {
    assert.deepEqual(classifyLookupQuery("64b1f0c8a1b2c3d4e5f60789"), {
      patientId: "64b1f0c8a1b2c3d4e5f60789",
    });
  });

  it("treats a mobile number as mobile", () => {
    assert.deepEqual(classifyLookupQuery(" 9876543210 "), { mobile: "9876543210" });
  });

  it("treats non-numeric text as a patient name", () => {
    assert.deepEqual(classifyLookupQuery("  Rahul Patel "), { patientName: "Rahul Patel" });
  });

  it("returns empty for blank input", () => {
    assert.deepEqual(classifyLookupQuery("   "), {});
  });
});

describe("maskMobile", () => {
  it("masks all but the last four digits", () => {
    assert.equal(maskMobile("9876543210"), "******3210");
    assert.equal(maskMobile(" 1234 "), "****");
    assert.equal(maskMobile(""), "");
  });
});

describe("permanentPatientId", () => {
  it("prefers stored patient_id over the visit document id", () => {
    assert.equal(
      permanentPatientId({ id: "visit-2", patient_id: "patient-1" }),
      "patient-1",
    );
  });

  it("falls back to the visit id for a first registration", () => {
    assert.equal(permanentPatientId({ id: "visit-1", patient_id: "" }), "visit-1");
  });
});
