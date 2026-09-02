import {
  ACTIVE_BED_ASSIGNMENT_STATUSES,
  ASSIGNABLE_BED_STATUSES,
  BedStatus,
} from "../constants";
import { Bed, type BedDocument } from "../models/bed.model";
import { Patient } from "../models/patient.model";
import { Room, type RoomDocument } from "../models/room.model";
import { isMongoObjectId } from "../http/validation";
import { canReceiveBedAssignment, markPatientAdmitted, markPatientDischargedIfAdmitted } from "../patients/admission";

export const ROOM_NOT_FOUND = "Room not found.";
export const BED_NOT_FOUND = "Bed not found.";
export const PATIENT_NOT_FOUND = "Patient not found.";
export const BED_NOT_ASSIGNABLE = "Only available beds can be assigned.";
export const PATIENT_ALREADY_ASSIGNED = "This patient is already assigned to another bed.";
export const ROOM_AT_CAPACITY = "This room has no remaining bed capacity.";
export const DUPLICATE_ROOM_NUMBER = "A room with this room number already exists.";
export const DUPLICATE_BED_NUMBER = "A bed with this number already exists in the room.";
export const ROOM_HAS_ACTIVE_BEDS = "Cannot delete a room that has occupied or reserved beds.";
export const BED_IN_USE = "Cannot delete an occupied or reserved bed.";
export const RELEASE_GUARD = "Only occupied or reserved beds can be released.";
export const STATUS_OCCUPIED_GUARD = "Use assign to occupy a bed.";
export const OCCUPIED_STATUS_GUARD = "Occupied beds must be released before changing status.";
export const CAPACITY_BELOW_BEDS = "Capacity cannot be less than the number of beds in the room.";

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

export async function findRoomById(pk: string): Promise<RoomDocument | null> {
  if (!isMongoObjectId(pk)) {
    return null;
  }
  return Room.findById(pk).exec();
}

export async function findBedById(pk: string): Promise<BedDocument | null> {
  if (!isMongoObjectId(pk)) {
    return null;
  }
  return Bed.findById(pk).exec();
}

export async function findPatientById(pk: string): Promise<{ id: string } | null> {
  if (!isMongoObjectId(pk)) {
    return null;
  }
  const patient = await Patient.findById(pk).select({ _id: 1 }).exec();
  if (!patient) {
    return null;
  }
  return { id: String(patient._id) };
}

export async function countBedsInRoom(roomId: string): Promise<number> {
  return Bed.countDocuments({ room_id: roomId }).exec();
}

export async function roomHasActiveBeds(roomId: string): Promise<boolean> {
  const count = await Bed.countDocuments({
    room_id: roomId,
    status: { $in: ACTIVE_BED_ASSIGNMENT_STATUSES },
  }).exec();
  return count > 0;
}

export async function findActiveBedForPatient(
  patientId: string,
  excludeBedId?: string,
): Promise<BedDocument | null> {
  const filter: Record<string, unknown> = {
    patient_id: patientId,
    status: { $in: ACTIVE_BED_ASSIGNMENT_STATUSES },
  };
  if (excludeBedId) {
    filter._id = { $ne: excludeBedId };
  }
  return Bed.findOne(filter).exec();
}

export async function assignPatientToBed(
  bedId: string,
  patientId: string,
): Promise<{ ok: true; bed: BedDocument } | { ok: false; statusCode: number; message: string }> {
  if (!isMongoObjectId(patientId)) {
    return { ok: false, statusCode: 404, message: PATIENT_NOT_FOUND };
  }
  const visit = await Patient.findById(patientId)
    .select({ care_type: 1, admission_status: 1 })
    .exec();
  if (!visit) {
    return { ok: false, statusCode: 404, message: PATIENT_NOT_FOUND };
  }

  const allowed = canReceiveBedAssignment(visit);
  if (!allowed.ok) {
    return { ok: false, statusCode: 400, message: allowed.message };
  }

  const existing = await findActiveBedForPatient(String(visit._id), bedId);
  if (existing) {
    return { ok: false, statusCode: 400, message: PATIENT_ALREADY_ASSIGNED };
  }

  const now = new Date();
  try {
    const updated = await Bed.findOneAndUpdate(
      { _id: bedId, status: { $in: ASSIGNABLE_BED_STATUSES } },
      {
        $set: {
          status: BedStatus.OCCUPIED,
          patient_id: String(visit._id),
          assigned_at: now,
          updated_at: now,
        },
      },
      { returnDocument: "after" },
    ).exec();

    if (updated) {
      await markPatientAdmitted(String(visit._id));
      return { ok: true, bed: updated };
    }
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return { ok: false, statusCode: 400, message: PATIENT_ALREADY_ASSIGNED };
    }
    throw error;
  }

  const bed = await findBedById(bedId);
  if (!bed) {
    return { ok: false, statusCode: 404, message: BED_NOT_FOUND };
  }
  return { ok: false, statusCode: 400, message: BED_NOT_ASSIGNABLE };
}

export async function releaseBed(
  bedId: string,
): Promise<
  | { ok: true; bed: BedDocument; previousPatientId: string | null }
  | { ok: false; statusCode: number; message: string }
> {
  const current = await findBedById(bedId);
  if (!current) {
    return { ok: false, statusCode: 404, message: BED_NOT_FOUND };
  }
  if (!(ACTIVE_BED_ASSIGNMENT_STATUSES as readonly string[]).includes(current.status)) {
    return { ok: false, statusCode: 400, message: RELEASE_GUARD };
  }

  const previousPatientId = current.patient_id || null;
  const now = new Date();
  const updated = await Bed.findOneAndUpdate(
    { _id: bedId, status: { $in: ACTIVE_BED_ASSIGNMENT_STATUSES } },
    {
      $set: {
        status: BedStatus.AVAILABLE,
        patient_id: null,
        assigned_at: null,
        updated_at: now,
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    return { ok: false, statusCode: 400, message: RELEASE_GUARD };
  }
  if (previousPatientId) {
    await markPatientDischargedIfAdmitted(previousPatientId);
  }
  return { ok: true, bed: updated, previousPatientId };
}

export async function releaseActiveBedForPatient(
  patientId: string,
): Promise<{ bed: BedDocument; previousPatientId: string } | null> {
  const bed = await findActiveBedForPatient(patientId);
  if (!bed) {
    return null;
  }
  const previousPatientId = bed.patient_id || patientId;
  const result = await releaseBed(String(bed._id));
  if (!result.ok) {
    return null;
  }
  return { bed: result.bed, previousPatientId: result.previousPatientId || previousPatientId };
}

export async function updateBedStatus(
  bedId: string,
  status: BedStatus,
): Promise<{ ok: true; bed: BedDocument } | { ok: false; statusCode: number; message: string }> {
  if (status === BedStatus.OCCUPIED) {
    return { ok: false, statusCode: 400, message: STATUS_OCCUPIED_GUARD };
  }

  const bed = await findBedById(bedId);
  if (!bed) {
    return { ok: false, statusCode: 404, message: BED_NOT_FOUND };
  }
  if (bed.status === BedStatus.OCCUPIED) {
    return { ok: false, statusCode: 400, message: OCCUPIED_STATUS_GUARD };
  }

  const now = new Date();
  bed.status = status;
  if (status !== BedStatus.RESERVED) {
    bed.patient_id = null;
    bed.assigned_at = null;
  }
  bed.updated_at = now;
  await bed.save();
  return { ok: true, bed };
}
