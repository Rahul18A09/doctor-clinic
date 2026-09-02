import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { occupancyByRoomIds, occupancyForRoom } from "../beds/counts";
import { ensureBedManagementIndexes } from "../beds/indexes";
import {
  CAPACITY_BELOW_BEDS,
  DUPLICATE_ROOM_NUMBER,
  ROOM_HAS_ACTIVE_BEDS,
  ROOM_NOT_FOUND,
  countBedsInRoom,
  findRoomById,
  isDuplicateKeyError,
  roomHasActiveBeds,
} from "../beds/operations";
import { serializeBed, serializeRoom } from "../beds/serialize";
import { ROOM_TYPES, type RoomType } from "../constants";
import { hasFieldErrors, type FieldErrors } from "../http/errors";
import { buildPaginationMeta, parsePagination } from "../http/pagination";
import {
  errorResponse,
  notFoundResponse,
  paginatedSuccessResponse,
  successResponse,
  validationErrorResponse,
} from "../http/responses";
import {
  collectFieldErrors,
  icontainsRegex,
  readBody,
  readOptionalChoice,
  readOptionalInt,
  readOptionalString,
  readQueryString,
  readRequiredChoice,
  readRequiredInt,
  readRequiredString,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { canManageBeds, canViewBeds } from "../middleware/authorize";
import { Bed } from "../models/bed.model";
import { Room } from "../models/room.model";

type CreateRoomInput = {
  room_number: string;
  room_type: RoomType;
  floor: string;
  capacity: number;
  notes: string;
};

type UpdateRoomInput = {
  room_number?: string;
  room_type?: RoomType;
  floor?: string;
  capacity?: number;
  notes?: string;
};

const withIndexes: RequestHandler = async (_req: Request, _res: Response, next: NextFunction) => {
  await ensureBedManagementIndexes();
  next();
};

const viewStaff: RequestHandler[] = [authenticate, canViewBeds, withIndexes];
const adminStaff: RequestHandler[] = [authenticate, canManageBeds, withIndexes];

function validateCreate(
  body: Record<string, unknown>,
): { ok: true; value: CreateRoomInput } | { ok: false; errors: FieldErrors } {
  const roomNumber = readRequiredString(body, "room_number", { maxLength: 50 });
  const roomType = readRequiredChoice<RoomType>(body, "room_type", ROOM_TYPES);
  const floor = readRequiredString(body, "floor", { maxLength: 50 });
  const capacity = readRequiredInt(body, "capacity", { min: 1, max: 200 });
  const notes = readOptionalString(body, "notes", { maxLength: 1000, allowBlank: true });

  const errors = collectFieldErrors({
    room_number: roomNumber,
    room_type: roomType,
    floor,
    capacity,
    notes,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      room_number: roomNumber.value as string,
      room_type: roomType.value as RoomType,
      floor: floor.value as string,
      capacity: capacity.value as number,
      notes: notes.value ?? "",
    },
  };
}

function validateUpdate(
  body: Record<string, unknown>,
): { ok: true; value: UpdateRoomInput } | { ok: false; errors: FieldErrors } {
  const roomNumber = readOptionalString(body, "room_number", { maxLength: 50 });
  const roomType = readOptionalChoice<RoomType>(body, "room_type", ROOM_TYPES);
  const floor = readOptionalString(body, "floor", { maxLength: 50 });
  const capacity = readOptionalInt(body, "capacity", { min: 1, max: 200 });
  const notes = readOptionalString(body, "notes", { maxLength: 1000, allowBlank: true });

  const errors = collectFieldErrors({
    room_number: roomNumber,
    room_type: roomType,
    floor,
    capacity,
    notes,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  const patch: UpdateRoomInput = {};
  if (roomNumber.value !== undefined) patch.room_number = roomNumber.value;
  if (roomType.value) patch.room_type = roomType.value;
  if (floor.value !== undefined) patch.floor = floor.value;
  if (capacity.value !== undefined) patch.capacity = capacity.value;
  if (notes.value !== undefined) patch.notes = notes.value;
  return { ok: true, value: patch };
}

const listRooms: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const search = readQueryString(req.query.search);
  const roomType = readQueryString(req.query.room_type);
  const floor = readQueryString(req.query.floor);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [{ room_number: icontainsRegex(search) }, { notes: icontainsRegex(search) }];
  }
  if (roomType && (ROOM_TYPES as readonly string[]).includes(roomType)) {
    filter.room_type = roomType;
  }
  if (floor) {
    filter.floor = icontainsRegex(floor);
  }

  const total = await Room.countDocuments(filter).exec();
  const rooms = await Room.find(filter)
    .sort({ room_number: 1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();
  const occupancy = await occupancyByRoomIds(rooms.map((room) => String(room._id)));

  paginatedSuccessResponse(res, {
    message: "Rooms retrieved successfully.",
    results: rooms.map((room) =>
      serializeRoom(room, occupancy.get(String(room._id)) ?? { bed_count: 0, available_count: 0 }),
    ),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const createRoom: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateCreate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }
  try {
    const room = await Room.create(parsed.value);
    successResponse(res, {
      statusCode: 201,
      message: "Room created successfully.",
      data: { room: serializeRoom(room, { bed_count: 0, available_count: 0 }) },
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      validationErrorResponse(res, { room_number: [DUPLICATE_ROOM_NUMBER] });
      return;
    }
    throw error;
  }
};

const getRoom: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const room = await findRoomById(String(req.params["pk"] ?? ""));
  if (!room) {
    notFoundResponse(res, ROOM_NOT_FOUND);
    return;
  }
  const beds = await Bed.find({ room_id: String(room._id) }).sort({ bed_number: 1 }).exec();
  const occupancy = await occupancyForRoom(String(room._id));
  successResponse(res, {
    message: "Room retrieved successfully.",
    data: {
      room: serializeRoom(room, occupancy),
      beds: beds.map(serializeBed),
    },
  });
};

const updateRoom: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const room = await findRoomById(String(req.params["pk"] ?? ""));
  if (!room) {
    notFoundResponse(res, ROOM_NOT_FOUND);
    return;
  }
  const parsed = validateUpdate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }
  if (parsed.value.capacity !== undefined) {
    const bedCount = await countBedsInRoom(String(room._id));
    if (parsed.value.capacity < bedCount) {
      validationErrorResponse(res, { capacity: [CAPACITY_BELOW_BEDS] });
      return;
    }
  }
  if (parsed.value.room_number !== undefined) room.room_number = parsed.value.room_number;
  if (parsed.value.room_type !== undefined) room.room_type = parsed.value.room_type;
  if (parsed.value.floor !== undefined) room.floor = parsed.value.floor;
  if (parsed.value.capacity !== undefined) room.capacity = parsed.value.capacity;
  if (parsed.value.notes !== undefined) room.notes = parsed.value.notes;
  try {
    await room.save();
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      validationErrorResponse(res, { room_number: [DUPLICATE_ROOM_NUMBER] });
      return;
    }
    throw error;
  }
  const occupancy = await occupancyForRoom(String(room._id));
  successResponse(res, {
    message: "Room updated successfully.",
    data: { room: serializeRoom(room, occupancy) },
  });
};

const deleteRoom: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const room = await findRoomById(String(req.params["pk"] ?? ""));
  if (!room) {
    notFoundResponse(res, ROOM_NOT_FOUND);
    return;
  }
  if (await roomHasActiveBeds(String(room._id))) {
    errorResponse(res, { message: ROOM_HAS_ACTIVE_BEDS, statusCode: 400 });
    return;
  }
  await Bed.deleteMany({ room_id: String(room._id) }).exec();
  await room.deleteOne();
  successResponse(res, { message: "Room deleted successfully." });
};

const roomsRouter = Router();
roomsRouter.get("/", ...viewStaff, listRooms);
roomsRouter.post("/", ...adminStaff, createRoom);
roomsRouter.get("/:pk/", ...viewStaff, getRoom);
roomsRouter.get("/:pk", ...viewStaff, getRoom);
roomsRouter.put("/:pk/", ...adminStaff, updateRoom);
roomsRouter.put("/:pk", ...adminStaff, updateRoom);
roomsRouter.delete("/:pk/", ...adminStaff, deleteRoom);
roomsRouter.delete("/:pk", ...adminStaff, deleteRoom);

export default roomsRouter;
