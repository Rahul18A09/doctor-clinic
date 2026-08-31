import assert from "node:assert/strict";

import { connectDatabase, disconnectDatabase } from "../config/database";
import { Patient } from "../models/patient.model";

async function main(): Promise<void> {
  await connectDatabase();

  const rawBefore = await Patient.collection.findOne({});
  if (!rawBefore) {
    throw new Error("No documents found in collection 'patients'.");
  }

  const patient = await Patient.findById(rawBefore._id).lean().exec();
  if (!patient) {
    throw new Error(`Mongoose could not read patient ${String(rawBefore._id)}.`);
  }

  const rawAfter = await Patient.collection.findOne({ _id: rawBefore._id });
  assert.deepEqual(rawAfter, rawBefore, "Read path modified the MongoDB document.");

  console.log("Read existing patient from collection 'patients' (no writes).");
  console.log(
    JSON.stringify(
      {
        collection: Patient.collection.collectionName,
        id: String(patient._id),
        token_number: patient.token_number,
        visit_number: patient.visit_number,
        patient_name: patient.patient_name,
        mobile: patient.mobile,
        age: patient.age,
        gender: patient.gender,
        blood_group: patient.blood_group ?? null,
        status: patient.status,
        chief_complaint: patient.chief_complaint,
        created_by: patient.created_by,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        consultation_started_at: patient.consultation_started_at ?? null,
        consultation_completed_at: patient.consultation_completed_at ?? null,
        document_unchanged: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to read existing patient: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
