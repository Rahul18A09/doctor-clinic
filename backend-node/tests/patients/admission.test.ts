import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdmissionStatus, CareType, LEGACY_ADMISSION_REQUIRED, PatientStatus } from "../../src/constants";
import { applyCareTypeDecision, canReceiveBedAssignment } from "../../src/patients/admission";

describe("admission helpers", () => {
  it("rejects bed assignment unless the visit is Inpatient and admission is pending", () => {
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
        admission_status: AdmissionStatus.PENDING,
      }).ok,
      true,
    );
    assert.equal(
      canReceiveBedAssignment({
        care_type: CareType.INPATIENT,
        admission_status: LEGACY_ADMISSION_REQUIRED,
      }).ok,
      true,
    );
  });

  it("sets Pending for Inpatient and Not Required for Outpatient", () => {
    const waiting = { status: PatientStatus.WAITING, care_type: undefined, admission_status: undefined };
    const inpatient = applyCareTypeDecision(waiting, CareType.INPATIENT);
    assert.equal(inpatient.ok, true);
    if (inpatient.ok) {
      assert.equal(inpatient.patch.care_type, CareType.INPATIENT);
      assert.equal(inpatient.patch.admission_status, AdmissionStatus.PENDING);
      assert.equal(inpatient.notifyRequired, true);
    }

    const admitted = {
      status: PatientStatus.IN_CONSULTATION,
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.ADMITTED,
    };
    const locked = applyCareTypeDecision(admitted, CareType.OUTPATIENT);
    assert.equal(locked.ok, false);

    const pending = {
      status: PatientStatus.WAITING,
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.PENDING,
    };
    const outpatient = applyCareTypeDecision(pending, CareType.OUTPATIENT);
    assert.equal(outpatient.ok, true);
    if (outpatient.ok) {
      assert.equal(outpatient.patch.care_type, CareType.OUTPATIENT);
      assert.equal(outpatient.patch.admission_status, AdmissionStatus.NOT_REQUIRED);
      assert.equal(outpatient.unset.length, 0);
    }
  });
});
