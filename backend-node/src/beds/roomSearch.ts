import { Types } from "mongoose";

import { icontainsRegex } from "../http/validation";
import { Bed } from "../models/bed.model";
import { Patient } from "../models/patient.model";
import { parseTokenSearchSequence } from "../patients/search";

/**
 * Patient clauses for bed/room search: name or phone only (no token).
 * Token-like queries (`01`, `P0003`) are ignored so they only match room/bed text.
 */
export function buildBedPatientSearchOrClauses(search: string): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) {
    return [];
  }

  if (/^\d{5,15}$/.test(trimmed)) {
    return [{ mobile: icontainsRegex(trimmed) }];
  }

  // Token-like input is not used for bed patient lookup (collides with room numbers).
  if (parseTokenSearchSequence(trimmed) != null) {
    return [];
  }

  return [{ patient_name: icontainsRegex(trimmed) }];
}

/** Room ids whose beds match bed_number or an assigned patient (name / phone). */
export async function roomIdsMatchingBedOrPatientSearch(search: string): Promise<string[]> {
  const trimmed = search.trim();
  if (!trimmed) {
    return [];
  }

  const ids = new Set<string>();
  const pattern = icontainsRegex(trimmed);

  const bedsByNumber = await Bed.find({ bed_number: pattern }).select({ room_id: 1 }).lean().exec();
  for (const bed of bedsByNumber) {
    if (bed.room_id) {
      ids.add(String(bed.room_id));
    }
  }

  const patientOr = buildBedPatientSearchOrClauses(trimmed);
  if (patientOr.length > 0) {
    const patientFilter =
      patientOr.length === 1 && patientOr[0] ? patientOr[0] : { $or: patientOr };
    const patients = await Patient.find(patientFilter).select({ _id: 1 }).lean().exec();
    const patientIds = patients.map((patient) => String(patient._id));
    if (patientIds.length > 0) {
      const assignedBeds = await Bed.find({ patient_id: { $in: patientIds } })
        .select({ room_id: 1 })
        .lean()
        .exec();
      for (const bed of assignedBeds) {
        if (bed.room_id) {
          ids.add(String(bed.room_id));
        }
      }
    }
  }

  return [...ids];
}

/** Room list `$or` for text search: room fields plus rooms found via beds/patients. */
export function buildRoomListSearchFilter(
  search: string,
  matchedRoomIds: readonly string[],
): Record<string, unknown> {
  const pattern = icontainsRegex(search);
  const or: Record<string, unknown>[] = [{ room_number: pattern }, { notes: pattern }];

  const objectIds = matchedRoomIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  if (objectIds.length > 0) {
    or.push({ _id: { $in: objectIds } });
  }

  return { $or: or };
}
