import { toDjangoIso } from "../auth/iso";
import { PatientStatus, normalizeAdmissionStatus } from "../constants";
import type { AssignedBedInfo } from "./assignedBeds";
import { assignedBedsByPatientId } from "./assignedBeds";
import { formatTokenForDisplay } from "./tokens";
import { permanentPatientId } from "./visits";

export type SerializedPatient = {
  id: string;
  patient_id: string;
  token_number: string;
  visit_number: number;
  patient_name: string;
  mobile: string;
  age: number;
  gender: string;
  blood_group: string;
  address: string;
  chief_complaint: string;
  status: string;
  created_by: string;
  created_by_name: string;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  is_editable_by_receptionist: boolean;
  is_editable_by_admin: boolean;
  doctor_notes: string;
  diagnosis: string;
  prescription: string;
  temperature: number | null;
  blood_pressure: string;
  pulse: string;
  weight: number | null;
  height: number | null;
  consultation_started_at: string | null;
  consultation_completed_at: string | null;
  consulted_by: string;
  consulted_by_name: string;
  updated_by: string;
  updated_by_name: string;
  care_type: string;
  admission_status: string;
  admitted_at: string | null;
  discharged_at: string | null;
  assigned_bed: AssignedBedInfo | null;
};

function nullableNumber(value: number | null | undefined): number | null {
  return value === undefined || value === null ? null : value;
}

/** Matches Django `PatientSerializer.to_representation`. */
export function serializePatient(patient: {
  _id?: { toString(): string };
  id?: string;
  patient_id?: string | null;
  token_number?: string | null;
  visit_number?: number | null;
  patient_name: string;
  mobile: string;
  age: number;
  gender: string;
  blood_group?: string | null;
  address?: string | null;
  chief_complaint: string;
  status: string;
  created_by: string;
  created_by_name?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
  completed_at?: Date | null;
  consultation_completed_at?: Date | null;
  doctor_notes?: string | null;
  diagnosis?: string | null;
  prescription?: string | null;
  temperature?: number | null;
  blood_pressure?: string | null;
  pulse?: string | null;
  weight?: number | null;
  height?: number | null;
  consultation_started_at?: Date | null;
  consulted_by?: string | null;
  consulted_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  care_type?: string | null;
  admission_status?: string | null;
  admitted_at?: Date | null;
  discharged_at?: Date | null;
}, assignedBed: AssignedBedInfo | null = null): SerializedPatient {
  return {
    id: patient.id ?? String(patient._id),
    patient_id: permanentPatientId(patient),
    token_number: formatTokenForDisplay(patient.token_number),
    visit_number: patient.visit_number || 1,
    patient_name: patient.patient_name,
    mobile: patient.mobile,
    age: patient.age,
    gender: patient.gender,
    blood_group: patient.blood_group || "",
    address: patient.address || "",
    chief_complaint: patient.chief_complaint,
    status: patient.status,
    created_by: patient.created_by,
    created_by_name: patient.created_by_name || "",
    created_at: toDjangoIso(patient.created_at),
    updated_at: toDjangoIso(patient.updated_at),
    completed_at: toDjangoIso(patient.completed_at || patient.consultation_completed_at),
    is_editable_by_receptionist: patient.status === PatientStatus.WAITING,
    is_editable_by_admin: true,
    doctor_notes: patient.doctor_notes || "",
    diagnosis: patient.diagnosis || "",
    prescription: patient.prescription || "",
    temperature: nullableNumber(patient.temperature),
    blood_pressure: patient.blood_pressure || "",
    pulse: patient.pulse || "",
    weight: nullableNumber(patient.weight),
    height: nullableNumber(patient.height),
    consultation_started_at: toDjangoIso(patient.consultation_started_at),
    consultation_completed_at: toDjangoIso(patient.consultation_completed_at),
    consulted_by: patient.consulted_by || "",
    consulted_by_name: patient.consulted_by_name || "",
    updated_by: patient.updated_by || "",
    updated_by_name: patient.updated_by_name || "",
    care_type: patient.care_type || "",
    admission_status: normalizeAdmissionStatus(patient.care_type, patient.admission_status),
    admitted_at: toDjangoIso(patient.admitted_at),
    discharged_at: toDjangoIso(patient.discharged_at),
    assigned_bed: assignedBed,
  };
}

export async function serializePatientsWithBeds(
  patients: Array<Parameters<typeof serializePatient>[0] & { _id?: { toString(): string }; id?: string }>,
): Promise<SerializedPatient[]> {
  const assignedBeds = await assignedBedsByPatientId(
    patients.map((row) => String(row.id ?? row._id)),
  );
  return patients.map((row) => serializePatient(row, assignedBeds[String(row.id ?? row._id)] ?? null));
}

export async function serializePatientWithBed(
  patient: Parameters<typeof serializePatient>[0] & { _id?: { toString(): string }; id?: string },
): Promise<SerializedPatient> {
  const assignedBeds = await assignedBedsByPatientId([String(patient.id ?? patient._id)]);
  return serializePatient(patient, assignedBeds[String(patient.id ?? patient._id)] ?? null);
}
