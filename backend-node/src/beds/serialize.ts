import { toDjangoIso } from "../auth/iso";
import type { BedStatus, RoomType } from "../constants";
import type { BedDocument } from "../models/bed.model";
import type { RoomDocument } from "../models/room.model";

export type SerializedRoom = {
  id: string;
  room_number: string;
  room_type: RoomType;
  floor: string;
  capacity: number;
  notes: string;
  bed_count: number;
  available_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type SerializedBed = {
  id: string;
  room_id: string;
  bed_number: string;
  status: BedStatus;
  patient_id: string | null;
  assigned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RoomOccupancy = {
  bed_count: number;
  available_count: number;
};

export function serializeRoom(
  room: RoomDocument | { _id?: { toString(): string }; id?: string } & {
    room_number: string;
    room_type: RoomType;
    floor: string;
    capacity: number;
    notes?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
  },
  occupancy: RoomOccupancy = { bed_count: 0, available_count: 0 },
): SerializedRoom {
  return {
    id: room.id ?? String(room._id),
    room_number: room.room_number,
    room_type: room.room_type,
    floor: room.floor,
    capacity: room.capacity,
    notes: room.notes ?? "",
    bed_count: occupancy.bed_count,
    available_count: occupancy.available_count,
    created_at: toDjangoIso(room.created_at),
    updated_at: toDjangoIso(room.updated_at),
  };
}

export function serializeBed(
  bed: BedDocument | { _id?: { toString(): string }; id?: string } & {
    room_id: string;
    bed_number: string;
    status: BedStatus;
    patient_id?: string | null;
    assigned_at?: Date | null;
    created_at?: Date | null;
    updated_at?: Date | null;
  },
): SerializedBed {
  return {
    id: bed.id ?? String(bed._id),
    room_id: bed.room_id,
    bed_number: bed.bed_number,
    status: bed.status,
    patient_id: bed.patient_id || null,
    assigned_at: toDjangoIso(bed.assigned_at),
    created_at: toDjangoIso(bed.created_at),
    updated_at: toDjangoIso(bed.updated_at),
  };
}
