import { BedStatus } from "../constants";
import { Bed } from "../models/bed.model";
import type { RoomOccupancy } from "./serialize";

export type BedSummary = {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  blocked: number;
};

const EMPTY_SUMMARY: BedSummary = {
  total: 0,
  available: 0,
  occupied: 0,
  reserved: 0,
  maintenance: 0,
  blocked: 0,
};

function emptyOccupancy(): RoomOccupancy {
  return { bed_count: 0, available_count: 0 };
}

/** Available-bed counts are always derived from current bed statuses. */
export async function computeBedSummary(): Promise<BedSummary> {
  const rows = await Bed.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).exec();

  const summary: BedSummary = { ...EMPTY_SUMMARY };
  for (const row of rows) {
    summary.total += row.count;
    if (row._id === BedStatus.AVAILABLE) summary.available = row.count;
    if (row._id === BedStatus.OCCUPIED) summary.occupied = row.count;
    if (row._id === BedStatus.RESERVED) summary.reserved = row.count;
    if (row._id === BedStatus.MAINTENANCE) summary.maintenance = row.count;
    if (row._id === BedStatus.BLOCKED) summary.blocked = row.count;
  }
  return summary;
}

export async function occupancyByRoomIds(roomIds: string[]): Promise<Map<string, RoomOccupancy>> {
  const map = new Map<string, RoomOccupancy>();
  for (const id of roomIds) {
    map.set(id, emptyOccupancy());
  }
  if (roomIds.length === 0) {
    return map;
  }

  const rows = await Bed.aggregate<{ _id: { room_id: string; status: string }; count: number }>([
    { $match: { room_id: { $in: roomIds } } },
    { $group: { _id: { room_id: "$room_id", status: "$status" }, count: { $sum: 1 } } },
  ]).exec();

  for (const row of rows) {
    const occupancy = map.get(row._id.room_id) ?? emptyOccupancy();
    occupancy.bed_count += row.count;
    if (row._id.status === BedStatus.AVAILABLE) {
      occupancy.available_count += row.count;
    }
    map.set(row._id.room_id, occupancy);
  }
  return map;
}

export async function occupancyForRoom(roomId: string): Promise<RoomOccupancy> {
  const map = await occupancyByRoomIds([roomId]);
  return map.get(roomId) ?? emptyOccupancy();
}
