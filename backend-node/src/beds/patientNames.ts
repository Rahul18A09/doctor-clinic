import { Types } from "mongoose";

import { Patient } from "../models/patient.model";

/** Resolve display names for assigned bed patients in one query. */
export async function patientNamesByIds(
  patientIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      patientIds.filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ].filter((id) => Types.ObjectId.isValid(id));

  const map = new Map<string, string>();
  if (unique.length === 0) {
    return map;
  }

  const patients = await Patient.find({ _id: { $in: unique } })
    .select({ patient_name: 1 })
    .lean()
    .exec();

  for (const patient of patients) {
    map.set(String(patient._id), patient.patient_name);
  }
  return map;
}
