import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { hashDjangoPassword } from "../auth/password";
import { validateNewPassword } from "../auth/passwordValidation";
import { NotificationType, UserRole, type Gender } from "../constants";
import {
  displayPersonName,
  receptionistActivatedMessage,
  receptionistAddedMessage,
  receptionistDeactivatedMessage,
} from "../notifications/messages";
import { ADMIN_ROLES, notifyStaffSafe } from "../notifications/notifyStaff";
import { hasFieldErrors, type FieldErrors } from "../http/errors";
import { buildPaginationMeta, parsePagination } from "../http/pagination";
import {
  notFoundResponse,
  paginatedSuccessResponse,
  successResponse,
  validationErrorResponse,
} from "../http/responses";
import {
  collectFieldErrors,
  icontainsRegex,
  isMongoObjectId,
  readBody,
  readGender,
  readOptionalEmail,
  readOptionalString,
  readQueryString,
  readRequiredEmail,
  readRequiredString,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/authorize";
import { User, type UserDocument } from "../models/user.model";
import { emailExists } from "../receptionists/emailExists";
import { serializeReceptionist } from "../receptionists/serializeReceptionist";

const DUPLICATE_EMAIL = "A user with this email already exists.";
const PASSWORD_MISMATCH = "Passwords do not match.";
const NOT_FOUND = "Receptionist not found.";

type CreateInput = {
  full_name: string;
  email: string;
  mobile: string;
  password: string;
  gender: Gender;
};

type UpdateInput = {
  full_name?: string;
  email?: string;
  mobile?: string;
  gender?: Gender;
};

async function findReceptionistOr404(
  pk: string,
  res: Response,
): Promise<UserDocument | null> {
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  const receptionist = await User.findOne({
    _id: pk,
    role: UserRole.RECEPTIONIST,
    is_deleted: false,
  }).exec();
  if (!receptionist) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  return receptionist;
}

function receptionistPayload(user: UserDocument) {
  return { receptionist: serializeReceptionist(user) };
}

async function validateCreate(
  body: Record<string, unknown>,
): Promise<{ ok: true; value: CreateInput } | { ok: false; errors: FieldErrors }> {
  const fullName = readRequiredString(body, "full_name", { maxLength: 255 });
  const email = readRequiredEmail(body, "email");
  const mobile = readRequiredString(body, "mobile", { maxLength: 20 });
  const password = readRequiredString(body, "password", { strip: false });
  const confirmPassword = readRequiredString(body, "confirm_password", {
    strip: false,
  });
  const gender = readGender(body, true);

  if (email.value && (await emailExists(email.value))) {
    email.errors = [...email.errors, DUPLICATE_EMAIL];
  }
  if (password.value) {
    password.errors = [...password.errors, ...validateNewPassword(password.value)];
  }

  const errors = collectFieldErrors({
    full_name: fullName,
    email,
    mobile,
    password,
    confirm_password: confirmPassword,
    gender,
  });

  if (
    !hasFieldErrors(errors) &&
    password.value !== undefined &&
    confirmPassword.value !== undefined &&
    password.value !== confirmPassword.value
  ) {
    errors.confirm_password = [PASSWORD_MISMATCH];
  }

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      full_name: fullName.value as string,
      email: email.value as string,
      mobile: mobile.value as string,
      password: password.value as string,
      gender: gender.value as Gender,
    },
  };
}

async function validateUpdate(
  body: Record<string, unknown>,
  instanceId: string,
): Promise<{ ok: true; value: UpdateInput } | { ok: false; errors: FieldErrors }> {
  const fullName = readOptionalString(body, "full_name", { maxLength: 255 });
  const email = readOptionalEmail(body, "email");
  const mobile = readOptionalString(body, "mobile", { maxLength: 20 });
  const gender = readGender(body, false);

  if (email.value && (await emailExists(email.value, instanceId))) {
    email.errors = [...email.errors, DUPLICATE_EMAIL];
  }

  const errors = collectFieldErrors({
    full_name: fullName,
    email,
    mobile,
    gender,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  const patch: UpdateInput = {};
  if (fullName.value !== undefined) {
    patch.full_name = fullName.value;
  }
  if (email.value !== undefined) {
    patch.email = email.value;
  }
  if (mobile.value !== undefined) {
    patch.mobile = mobile.value;
  }
  if (gender.value) {
    patch.gender = gender.value;
  }
  return { ok: true, value: patch };
}

const listReceptionists: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const search = readQueryString(req.query.search);

  const filter: Record<string, unknown> = {
    role: UserRole.RECEPTIONIST,
    is_deleted: false,
  };
  if (search) {
    const pattern = icontainsRegex(search);
    filter["$or"] = [{ full_name: pattern }, { email: pattern }, { mobile: pattern }];
  }

  const total = await User.countDocuments(filter).exec();
  const receptionists = await User.find(filter)
    .sort({ created_at: -1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Receptionists retrieved successfully.",
    results: receptionists.map(serializeReceptionist),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const createReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = await validateCreate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }

  const receptionist = await User.create({
    full_name: parsed.value.full_name,
    email: parsed.value.email,
    mobile: parsed.value.mobile,
    password: await hashDjangoPassword(parsed.value.password),
    gender: parsed.value.gender,
    role: UserRole.RECEPTIONIST,
    is_active: true,
    is_deleted: false,
  });

  await notifyStaffSafe({
    type: NotificationType.STAFF,
    ...receptionistAddedMessage(displayPersonName(receptionist.full_name)),
    roles: ADMIN_ROLES,
  });

  successResponse(res, {
    statusCode: 201,
    message: "Receptionist created successfully.",
    data: receptionistPayload(receptionist),
  });
};

const getReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const receptionist = await findReceptionistOr404(String(req.params["pk"] ?? ""), res);
  if (!receptionist) {
    return;
  }
  successResponse(res, {
    message: "Receptionist retrieved successfully.",
    data: receptionistPayload(receptionist),
  });
};

const updateReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const receptionist = await findReceptionistOr404(String(req.params["pk"] ?? ""), res);
  if (!receptionist) {
    return;
  }

  const parsed = await validateUpdate(readBody(req.body), String(receptionist._id));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }

  if (parsed.value.full_name !== undefined) {
    receptionist.full_name = parsed.value.full_name;
  }
  if (parsed.value.email !== undefined) {
    receptionist.email = parsed.value.email;
  }
  if (parsed.value.mobile !== undefined) {
    receptionist.mobile = parsed.value.mobile;
  }
  if (parsed.value.gender !== undefined) {
    receptionist.gender = parsed.value.gender;
  }
  await receptionist.save();

  successResponse(res, {
    message: "Receptionist updated successfully.",
    data: receptionistPayload(receptionist),
  });
};

const deleteReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const receptionist = await findReceptionistOr404(String(req.params["pk"] ?? ""), res);
  if (!receptionist) {
    return;
  }
  receptionist.is_deleted = true;
  receptionist.is_active = false;
  await receptionist.save();
  successResponse(res, { message: "Receptionist deleted successfully." });
};

const activateReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const receptionist = await findReceptionistOr404(String(req.params["pk"] ?? ""), res);
  if (!receptionist) {
    return;
  }
  receptionist.is_active = true;
  await receptionist.save();
  await notifyStaffSafe({
    type: NotificationType.STAFF,
    ...receptionistActivatedMessage(displayPersonName(receptionist.full_name)),
    roles: ADMIN_ROLES,
  });
  successResponse(res, {
    message: "Receptionist activated successfully.",
    data: receptionistPayload(receptionist),
  });
};

const deactivateReceptionist: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const receptionist = await findReceptionistOr404(String(req.params["pk"] ?? ""), res);
  if (!receptionist) {
    return;
  }
  receptionist.is_active = false;
  await receptionist.save();
  await notifyStaffSafe({
    type: NotificationType.STAFF,
    ...receptionistDeactivatedMessage(displayPersonName(receptionist.full_name)),
    roles: ADMIN_ROLES,
  });
  successResponse(res, {
    message: "Receptionist deactivated successfully.",
    data: receptionistPayload(receptionist),
  });
};

const receptionistRouter = Router();
const adminOnly: RequestHandler[] = [authenticate, requireAdmin];

receptionistRouter.get("/", ...adminOnly, listReceptionists);
receptionistRouter.post("/", ...adminOnly, createReceptionist);
receptionistRouter.post("/:pk/activate/", ...adminOnly, activateReceptionist);
receptionistRouter.post("/:pk/activate", ...adminOnly, activateReceptionist);
receptionistRouter.post("/:pk/deactivate/", ...adminOnly, deactivateReceptionist);
receptionistRouter.post("/:pk/deactivate", ...adminOnly, deactivateReceptionist);
receptionistRouter.get("/:pk/", ...adminOnly, getReceptionist);
receptionistRouter.get("/:pk", ...adminOnly, getReceptionist);
receptionistRouter.put("/:pk/", ...adminOnly, updateReceptionist);
receptionistRouter.put("/:pk", ...adminOnly, updateReceptionist);
receptionistRouter.delete("/:pk/", ...adminOnly, deleteReceptionist);
receptionistRouter.delete("/:pk", ...adminOnly, deleteReceptionist);

export default receptionistRouter;
