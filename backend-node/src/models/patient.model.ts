import { Schema, model, type HydratedDocument } from "mongoose";

import { PATIENT_STATUSES, PatientStatus } from "../constants";

/**
 * Mirrors Django/MongoEngine `apps.patients.documents.Patient`.
 * Collection and field names stay identical so existing Atlas documents can be read as-is.
 * `strict: false` matches MongoEngine and keeps legacy extra keys (e.g. old `is_deleted`).
 */
export interface IPatient {
  token_number: string;
  visit_number: number;
  patient_id?: string;
  patient_name: string;
  mobile: string;
  age: number;
  gender: string;
  blood_group?: string;
  address?: string;
  chief_complaint: string;
  status: PatientStatus;
  created_by: string;
  created_by_name?: string;
  doctor_notes?: string;
  diagnosis?: string;
  prescription?: string;
  temperature?: number;
  blood_pressure?: string;
  pulse?: string;
  weight?: number;
  height?: number;
  consultation_started_at?: Date;
  consultation_completed_at?: Date;
  completed_at?: Date;
  consulted_by?: string;
  consulted_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  care_type?: string;
  admission_status?: string;
  admitted_at?: Date | null;
  discharged_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    token_number: { type: String, required: true, unique: true, maxlength: 20 },
    visit_number: { type: Number, required: true, min: 1, default: 1 },
    patient_id: { type: String, maxlength: 24 },
    patient_name: { type: String, required: true, maxlength: 255 },
    mobile: { type: String, required: true, maxlength: 20 },
    age: { type: Number, required: true, min: 0, max: 150 },
    gender: { type: String, required: true, maxlength: 20 },
    blood_group: { type: String, maxlength: 5 },
    address: { type: String },
    chief_complaint: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: PATIENT_STATUSES,
      default: PatientStatus.WAITING,
    },
    created_by: { type: String, required: true },
    created_by_name: { type: String },
    doctor_notes: { type: String },
    diagnosis: { type: String },
    prescription: { type: String },
    temperature: { type: Number },
    blood_pressure: { type: String, maxlength: 20 },
    pulse: { type: String, maxlength: 20 },
    weight: { type: Number },
    height: { type: Number },
    consultation_started_at: { type: Date },
    consultation_completed_at: { type: Date },
    completed_at: { type: Date },
    consulted_by: { type: String },
    consulted_by_name: { type: String },
    updated_by: { type: String },
    updated_by_name: { type: String },
    care_type: { type: String, maxlength: 20 },
    admission_status: { type: String, maxlength: 40 },
    admitted_at: { type: Date },
    discharged_at: { type: Date },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "patients",
    strict: false,
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
  },
);

// Matches MongoEngine unique token_number plus meta indexes.
// autoIndex is false: declarations only, not applied at runtime.
patientSchema.index({ token_number: 1 }, { unique: true });
patientSchema.index({ visit_number: 1 });
patientSchema.index({ mobile: 1 });
patientSchema.index({ patient_id: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ created_at: 1 });
patientSchema.index({ care_type: 1 });
patientSchema.index({ admission_status: 1 });

patientSchema.virtual("is_editable_by_receptionist").get(function (
  this: PatientDocument,
): boolean {
  return this.status === PatientStatus.WAITING;
});

patientSchema.virtual("is_editable_by_admin").get(function (): boolean {
  return true;
});

patientSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type PatientDocument = HydratedDocument<IPatient>;

export const Patient = model<IPatient>("Patient", patientSchema);
