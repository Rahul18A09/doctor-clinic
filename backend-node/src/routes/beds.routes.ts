import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { computeBedSummary } from "../beds/counts";
import { ensureBedManagementIndexes } from "../beds/indexes";
import {
  BED_IN_USE,
  BED_NOT_FOUND,
  DUPLICATE_BED_NUMBER,
  ROOM_AT_CAPACITY,
  ROOM_NOT_FOUND,
  assignPatientToBed,
  countBedsInRoom,
  findBedById,
  findRoomById,
  isDuplicateKeyError,
  releaseBed,
  updateBedStatus,
} from "../beds/operations";
import { serializeBed } from "../beds/serialize";
import { ACTIVE_BED_ASSIGNMENT_STATUSES, BED_STATUSES, BedStatus, type BedStatus as BedStatusValue } from "../constants";
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
  isMongoObjectId,
  readBody,
  readOptionalChoice,
  readOptionalString,
  readQueryString,
  readRequiredChoice,
  readRequiredString,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { canAssignBeds, canManageBeds, canViewBeds } from "../middleware/authorize";
import { Bed } from "../models/bed.model";
import {
  notifyBedAssigned,
  notifyBedReleased,
  notifyIfMaintenanceStarted,
} from "../notifications/bedEvents";

type CreateBedInput = {
  room_id: string;
  bed_number: string;
  status: BedStatusValue;
};

type UpdateBedInput = {
  bed_number?: string;
  status?: BedStatusValue;
};

const withIndexes: RequestHandler = async (_req: Request, _res: Response, next: NextFunction) => {
  await ensureBedManagementIndexes();
  next();
};

const viewStaff: RequestHandler[] = [authenticate, canViewBeds, withIndexes];
const assignStaff: RequestHandler[] = [authenticate, canAssignBeds, withIndexes];
const adminStaff: RequestHandler[] = [authenticate, canManageBeds, withIndexes];

function validateCreate(
  body: Record<string, unknown>,
): { ok: true; value: CreateBedInput } | { ok: false; errors: FieldErrors } {
  const roomId = readRequiredString(body, "room_id", { maxLength: 24 });
  const bedNumber = readRequiredString(body, "bed_number", { maxLength: 20 });
  const status = readOptionalChoice<BedStatusValue>(body, "status", BED_STATUSES);

  if (roomId.value && !isMongoObjectId(roomId.value)) {
    roomId.errors = [...roomId.errors, "Enter a valid room id."];
  }
  if (status.value === BedStatus.OCCUPIED) {
    status.errors = [...status.errors, "Use assign to occupy a bed."];
  }

  const errors = collectFieldErrors({
    room_id: roomId,
    bed_number: bedNumber,
    status,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      room_id: roomId.value as string,
      bed_number: bedNumber.value as string,
      status: (status.value as BedStatusValue | undefined) || BedStatus.AVAILABLE,
    },
  };
}

function validateUpdate(
  body: Record<string, unknown>,
): { ok: true; value: UpdateBedInput } | { ok: false; errors: FieldErrors } {
  const bedNumber = readOptionalString(body, "bed_number", { maxLength: 20 });
  const status = readOptionalChoice<BedStatusValue>(body, "status", BED_STATUSES);
  if (status.value === BedStatus.OCCUPIED) {
    status.errors = [...status.errors, "Use assign to occupy a bed."];
  }
  const errors = collectFieldErrors({
    bed_number: bedNumber,
    status,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }
  const patch: UpdateBedInput = {};
  if (bedNumber.value !== undefined) patch.bed_number = bedNumber.value;
  if (status.value) patch.status = status.value;
  return { ok: true, value: patch };
}

const listBeds: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const roomId = readQueryString(req.query.room_id);
  const patientId = readQueryString(req.query.patient_id);
  const status = readQueryString(req.query.status);

  const filter: Record<string, unknown> = {};
  if (roomId) {
    if (!isMongoObjectId(roomId)) {
      validationErrorResponse(res, { room_id: ["Enter a valid room id."] });
      return;
    }
    filter.room_id = roomId;
  }
  if (patientId) {
    if (!isMongoObjectId(patientId)) {
      validationErrorResponse(res, { patient_id: ["Enter a valid patient id."] });
      return;
    }
    filter.patient_id = patientId;
  }
  if (status) {
    if (!(BED_STATUSES as readonly string[]).includes(status)) {
      validationErrorResponse(res, { status: [`"${status}" is not a valid choice.`] });
      return;
    }
    filter.status = status;
  }

  const total = await Bed.countDocuments(filter).exec();
  const beds = await Bed.find(filter)
    .sort({ room_id: 1, bed_number: 1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Beds retrieved successfully.",
    results: beds.map(serializeBed),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const listAvailableBeds: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const roomId = readQueryString(req.query.room_id);
  const filter: Record<string, unknown> = { status: BedStatus.AVAILABLE };
  if (roomId) {
    if (!isMongoObjectId(roomId)) {
      validationErrorResponse(res, { room_id: ["Enter a valid room id."] });
      return;
    }
    filter.room_id = roomId;
  }

  const total = await Bed.countDocuments(filter).exec();
  const beds = await Bed.find(filter)
    .sort({ room_id: 1, bed_number: 1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Available beds retrieved successfully.",
    results: beds.map(serializeBed),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const getBedSummary: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  const summary = await computeBedSummary();
  successResponse(res, {
    message: "Bed summary retrieved successfully.",
    data: { summary },
  });
};

const createBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateCreate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }
  const room = await findRoomById(parsed.value.room_id);
  if (!room) {
    notFoundResponse(res, ROOM_NOT_FOUND);
    return;
  }
  const existingCount = await countBedsInRoom(parsed.value.room_id);
  if (existingCount >= room.capacity) {
    errorResponse(res, { message: ROOM_AT_CAPACITY, statusCode: 400 });
    return;
  }
  try {
    const bed = await Bed.create({
      room_id: parsed.value.room_id,
      bed_number: parsed.value.bed_number,
      status: parsed.value.status,
      patient_id: null,
      assigned_at: null,
    });
    successResponse(res, {
      statusCode: 201,
      message: "Bed created successfully.",
      data: { bed: serializeBed(bed) },
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      validationErrorResponse(res, { bed_number: [DUPLICATE_BED_NUMBER] });
      return;
    }
    throw error;
  }
};

const getBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const bed = await findBedById(String(req.params["pk"] ?? ""));
  if (!bed) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  successResponse(res, {
    message: "Bed retrieved successfully.",
    data: { bed: serializeBed(bed) },
  });
};

const updateBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const bed = await findBedById(String(req.params["pk"] ?? ""));
  if (!bed) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  const parsed = validateUpdate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }
  if (parsed.value.status !== undefined) {
    const previousStatus = bed.status;
    const result = await updateBedStatus(String(bed._id), parsed.value.status);
    if (!result.ok) {
      errorResponse(res, { message: result.message, statusCode: result.statusCode });
      return;
    }
    await notifyIfMaintenanceStarted(previousStatus, result.bed);
    if (parsed.value.bed_number !== undefined) {
      result.bed.bed_number = parsed.value.bed_number;
      try {
        await result.bed.save();
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) {
          validationErrorResponse(res, { bed_number: [DUPLICATE_BED_NUMBER] });
          return;
        }
        throw error;
      }
    }
    successResponse(res, {
      message: "Bed updated successfully.",
      data: { bed: serializeBed(result.bed) },
    });
    return;
  }
  if (parsed.value.bed_number !== undefined) {
    bed.bed_number = parsed.value.bed_number;
    try {
      await bed.save();
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        validationErrorResponse(res, { bed_number: [DUPLICATE_BED_NUMBER] });
        return;
      }
      throw error;
    }
  }
  successResponse(res, {
    message: "Bed updated successfully.",
    data: { bed: serializeBed(bed) },
  });
};

const deleteBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const bed = await findBedById(String(req.params["pk"] ?? ""));
  if (!bed) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  if ((ACTIVE_BED_ASSIGNMENT_STATUSES as readonly string[]).includes(bed.status)) {
    errorResponse(res, { message: BED_IN_USE, statusCode: 400 });
    return;
  }
  await bed.deleteOne();
  successResponse(res, { message: "Bed deleted successfully." });
};

const assignBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  const body = readBody(req.body);
  const patientId = readRequiredString(body, "patient_id", { maxLength: 24 });
  if (patientId.value && !isMongoObjectId(patientId.value)) {
    patientId.errors = [...patientId.errors, "Enter a valid patient id."];
  }
  const errors = collectFieldErrors({ patient_id: patientId });
  if (hasFieldErrors(errors)) {
    validationErrorResponse(res, errors);
    return;
  }
  const result = await assignPatientToBed(pk, patientId.value as string);
  if (!result.ok) {
    if (result.statusCode === 404) {
      notFoundResponse(res, result.message);
      return;
    }
    errorResponse(res, { message: result.message, statusCode: result.statusCode });
    return;
  }
  await notifyBedAssigned(result.bed);
  successResponse(res, {
    message: "Bed assigned successfully.",
    data: { bed: serializeBed(result.bed) },
  });
};

const releaseAssignedBed: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  const result = await releaseBed(pk);
  if (!result.ok) {
    if (result.statusCode === 404) {
      notFoundResponse(res, result.message);
      return;
    }
    errorResponse(res, { message: result.message, statusCode: result.statusCode });
    return;
  }
  await notifyBedReleased(result.bed, result.previousPatientId);
  successResponse(res, {
    message: "Bed released successfully.",
    data: { bed: serializeBed(result.bed) },
  });
};

const patchBedStatus: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, BED_NOT_FOUND);
    return;
  }
  const status = readRequiredChoice<BedStatusValue>(readBody(req.body), "status", BED_STATUSES);
  const errors = collectFieldErrors({ status });
  if (hasFieldErrors(errors)) {
    validationErrorResponse(res, errors);
    return;
  }
  const current = await findBedById(pk);
  const previousStatus = current?.status;
  const result = await updateBedStatus(pk, status.value as BedStatusValue);
  if (!result.ok) {
    if (result.statusCode === 404) {
      notFoundResponse(res, result.message);
      return;
    }
    errorResponse(res, { message: result.message, statusCode: result.statusCode });
    return;
  }
  if (previousStatus) {
    await notifyIfMaintenanceStarted(previousStatus, result.bed);
  }
  successResponse(res, {
    message: "Bed status updated successfully.",
    data: { bed: serializeBed(result.bed) },
  });
};

const bedsRouter = Router();
bedsRouter.get("/available/", ...viewStaff, listAvailableBeds);
bedsRouter.get("/available", ...viewStaff, listAvailableBeds);
bedsRouter.get("/summary/", ...viewStaff, getBedSummary);
bedsRouter.get("/summary", ...viewStaff, getBedSummary);
bedsRouter.get("/", ...viewStaff, listBeds);
bedsRouter.post("/", ...adminStaff, createBed);
bedsRouter.post("/:pk/assign/", ...assignStaff, assignBed);
bedsRouter.post("/:pk/assign", ...assignStaff, assignBed);
bedsRouter.post("/:pk/release/", ...assignStaff, releaseAssignedBed);
bedsRouter.post("/:pk/release", ...assignStaff, releaseAssignedBed);
bedsRouter.patch("/:pk/status/", ...adminStaff, patchBedStatus);
bedsRouter.patch("/:pk/status", ...adminStaff, patchBedStatus);
bedsRouter.get("/:pk/", ...viewStaff, getBed);
bedsRouter.get("/:pk", ...viewStaff, getBed);
bedsRouter.put("/:pk/", ...adminStaff, updateBed);
bedsRouter.put("/:pk", ...adminStaff, updateBed);
bedsRouter.delete("/:pk/", ...adminStaff, deleteBed);
bedsRouter.delete("/:pk", ...adminStaff, deleteBed);

export default bedsRouter;
