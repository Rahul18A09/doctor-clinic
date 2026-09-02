import {
  AdmissionStatus,
  CareType,
  PatientStatus,
  type AdmissionStatus as AdmissionStatusValue,
  type CareType as CareTypeValue,
} from "../constants";
import { Patient, type PatientDocument } from "../models/patient.model";

export const ONLY_INPATIENT_ASSIGN = "Only inpatients who require admission can be assigned a bed.";
export const ALREADY_DISCHARGED = "This visit has already been discharged.";
export const CARE_TYPE_COMPLETED_GUARD = "Patient type cannot be changed after treatment is completed.";
export const CARE_TYPE_ADMITTED_GUARD = "Discharge the patient before changing to Outpatient.";
export const NOT_ADMITTED_GUARD = "This patient is not currently admitted.";

export function canReceiveBedAssignment(patient: {
  care_type?: string | null;
  admission_status?: string | null;
}): { ok: true } | { ok: false; message: string } {
  if (patient.care_type !== CareType.INPATIENT) {
    return { ok: false, message: ONLY_INPATIENT_ASSIGN };
  }
  if (patient.admission_status === AdmissionStatus.DISCHARGED) {
    return { ok: false, message: ALREADY_DISCHARGED };
  }
  if (patient.admission_status === AdmissionStatus.ADMITTED) {
    return { ok: false, message: "This patient is already assigned to another bed." };
  }
  if (patient.admission_status && patient.admission_status !== AdmissionStatus.REQUIRED) {
    return { ok: false, message: ONLY_INPATIENT_ASSIGN };
  }
  return { ok: true };
}

export function applyCareTypeDecision(
  patient: Pick<PatientDocument, "status" | "care_type" | "admission_status">,
  careType: CareTypeValue,
): { ok: true; patch: Record<string, unknown>; unset: string[]; notifyRequired: boolean } | { ok: false; message: string } {
  if (patient.status === PatientStatus.COMPLETED) {
    return { ok: false, message: CARE_TYPE_COMPLETED_GUARD };
  }

  if (careType === CareType.OUTPATIENT) {
    if (patient.admission_status === AdmissionStatus.ADMITTED) {
      return { ok: false, message: CARE_TYPE_ADMITTED_GUARD };
    }
    return {
      ok: true,
      patch: { care_type: CareType.OUTPATIENT },
      unset: ["admission_status", "admitted_at", "discharged_at"],
      notifyRequired: false,
    };
  }

  if (patient.admission_status === AdmissionStatus.ADMITTED || patient.admission_status === AdmissionStatus.DISCHARGED) {
    return {
      ok: true,
      patch: { care_type: CareType.INPATIENT },
      unset: [],
      notifyRequired: false,
    };
  }

  const alreadyRequired =
    patient.care_type === CareType.INPATIENT && patient.admission_status === AdmissionStatus.REQUIRED;

  return {
    ok: true,
    patch: {
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.REQUIRED as AdmissionStatusValue,
      admitted_at: null,
      discharged_at: null,
    },
    unset: [],
    notifyRequired: !alreadyRequired,
  };
}

export async function markPatientAdmitted(patientId: string): Promise<void> {
  const now = new Date();
  await Patient.updateOne(
    { _id: patientId, care_type: CareType.INPATIENT },
    {
      $set: {
        admission_status: AdmissionStatus.ADMITTED,
        admitted_at: now,
        discharged_at: null,
        updated_at: now,
      },
    },
  ).exec();
}

export async function markPatientDischargedIfAdmitted(patientId: string): Promise<boolean> {
  const now = new Date();
  const result = await Patient.updateOne(
    {
      _id: patientId,
      care_type: CareType.INPATIENT,
      admission_status: AdmissionStatus.ADMITTED,
    },
    {
      $set: {
        admission_status: AdmissionStatus.DISCHARGED,
        discharged_at: now,
        updated_at: now,
      },
    },
  ).exec();
  return result.modifiedCount > 0;
}
