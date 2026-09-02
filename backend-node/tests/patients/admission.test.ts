import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdmissionStatus, CareType, PatientStatus } from "../../src/constants";
import { applyCareTypeDecision, canReceiveBedAssignment } from "../../src/patients/admission";

describe("admission helpers", () => {
  it("rejects bed assignment unless the visit is Inpatient and requires admission", () => {
    assert.equal(canReceiveBedAssignment({}).ok, false);
    assert.equal(canReceiveBedAssignment({ care_type: CareType.OUTPATIENT }).ok, false);
    assert.equal(
      canReceiveBedAssignment({
        care_type: CareType.INPATIENT,
        admission_status: AdmissionStatus.ADMITTED,
      }).ok,
      false,
    );
    assert.equal(
      canReceiveBedAssignment({
        care_type: CareType.INPATIENT,
        admission_status: AdmissionStatus.REQUIRED,
      }).ok,
      true,
    );
  });

  it("sets Admission Required for Inpatient and clears it for Outpatient", () => {
    const waiting = { status: PatientStatus.WAITING, care_type: undefined, admission_status: undefined };
    const inpatient = applyCareTypeDecision(waiting, CareType.INPATIENT);
    assert.equal(inpatient.ok, true);
    if (inpatient.ok) {
      assert.equal(inpatient.patch.care_type, CareType.INPATIENT);
      assert.equal(inpatient.patch.admission_status, AdmissionStatus.REQUIRED);
      assert.equal(inpatient.notifyRequired, true);
    }

    const admitted = {
      status: PatientStatus.IN_CONSULTATION,
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.ADMITTED,
    };
    const locked = applyCareTypeDecision(admitted, CareType.OUTPATIENT);
    assert.equal(locked.ok, false);

    const required = {
      status: PatientStatus.WAITING,
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.REQUIRED,
    };
    const outpatient = applyCareTypeDecision(required, CareType.OUTPATIENT);
    assert.equal(outpatient.ok, true);
    if (outpatient.ok) {
      assert.equal(outpatient.patch.care_type, CareType.OUTPATIENT);
      assert.ok(outpatient.unset.includes("admission_status"));
    }
  });
});
