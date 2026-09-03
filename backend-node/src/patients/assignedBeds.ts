import { ACTIVE_BED_ASSIGNMENT_STATUSES } from "../constants";
import { Bed } from "../models/bed.model";
import { Room } from "../models/room.model";

export type AssignedBedInfo = {
  room_number: string;
  bed_number: string;
  label: string;
};

export async function assignedBedsByPatientId(
  patientIds: string[],
): Promise<Record<string, AssignedBedInfo>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (ids.length === 0) {
    return {};
  }

  const beds = await Bed.find({
    patient_id: { $in: ids },
    status: { $in: ACTIVE_BED_ASSIGNMENT_STATUSES },
  }).exec();

  const roomIds = [...new Set(beds.map((bed) => bed.room_id).filter(Boolean))];
  const rooms = roomIds.length
    ? await Room.find({ _id: { $in: roomIds } }).select({ room_number: 1 }).exec()
    : [];
  const roomNumberById = Object.fromEntries(rooms.map((room) => [String(room._id), room.room_number]));

  const result: Record<string, AssignedBedInfo> = {};
  for (const bed of beds) {
    const patientId = bed.patient_id;
    if (!patientId || result[patientId]) {
      continue;
    }
    const roomNumber = roomNumberById[bed.room_id] || "";
    result[patientId] = {
      room_number: roomNumber,
      bed_number: bed.bed_number,
      label: roomNumber ? `Room ${roomNumber} · Bed ${bed.bed_number}` : `Bed ${bed.bed_number}`,
    };
  }
  return result;
}
