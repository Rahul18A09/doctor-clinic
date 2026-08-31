import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { toDjangoIso } from "../auth/iso";
import { NotificationType, UserRole, type Gender } from "../constants";
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
  readBloodGroup,
  readBody,
  readGender,
  readOptionalInt,
  readOptionalString,
  readQueryString,
  readRequiredInt,
  readRequiredString,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import {
  canCreatePatients,
  canDeletePatients,
  canUpdatePatients,
  canViewPatients,
} from "../middleware/authorize";
import { Patient, type PatientDocument } from "../models/patient.model";
import {
  newPatientMessage,
  patientNotificationSubject,
  returningPatientMessage,
} from "../notifications/messages";
import { RECEPTIONIST_ROLES, notifyIfEnabled, notifyQueueWaiting } from "../notifications/notifyStaff";
import { buildPatientListFilter } from "../patients/filters";
import { serializePatient } from "../patients/serializePatient";
import { getPatientStats } from "../patients/stats";
import { formatTokenForDisplay } from "../patients/tokens";
import {
  classifyLookupQuery,
  generateTokenNumber,
  isDuplicateKeyError,
  maskMobile,
  newPatientObjectId,
  resolveCreateIdentity,
  searchPatientIdentities,
  type PatientIdentity,
} from "../patients/visits";

const NOT_FOUND = "Patient not found.";
const EDIT_LOCKED =
  "Patient registration cannot be edited after consultation has started.";
/** Duplicate `token_number` races: unique index throws 11000; regenerate and retry. */
const CREATE_ATTEMPTS = 8;

type CreateInput = {
  patient_name: string;
  mobile: string;
  age: number;
  gender: Gender;
  blood_group: string;
  address: string;
  chief_complaint: string;
  patient_id: string;
};

type UpdateInput = {
  patient_name?: string;
  mobile?: string;
  age?: number;
  gender?: Gender;
  blood_group?: string;
  address?: string;
  chief_complaint?: string;
};

async function findPatientOr404(
  pk: string,
  res: Response,
): Promise<PatientDocument | null> {
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  const patient = await Patient.findById(pk).exec();
  if (!patient) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  return patient;
}

function validateCreate(
  body: Record<string, unknown>,
): { ok: true; value: CreateInput } | { ok: false; errors: FieldErrors } {
  const patientName = readRequiredString(body, "patient_name", { maxLength: 255 });
  const mobile = readRequiredString(body, "mobile", { maxLength: 20 });
  const age = readRequiredInt(body, "age", { min: 0, max: 150 });
  const gender = readGender(body, true);
  const bloodGroup = readBloodGroup(body, false);
  const address = readOptionalString(body, "address", { allowBlank: true });
  const chiefComplaint = readRequiredString(body, "chief_complaint");
  const patientId = readOptionalString(body, "patient_id", { maxLength: 24, allowBlank: true });

  const errors = collectFieldErrors({
    patient_name: patientName,
    mobile,
    age,
    gender,
    blood_group: bloodGroup,
    address,
    chief_complaint: chiefComplaint,
    patient_id: patientId,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      patient_name: patientName.value as string,
      mobile: mobile.value as string,
      age: age.value as number,
      gender: gender.value as Gender,
      blood_group: bloodGroup.value ?? "",
      address: address.value ?? "",
      chief_complaint: chiefComplaint.value as string,
      patient_id: patientId.value ?? "",
    },
  };
}

function validateUpdate(
  body: Record<string, unknown>,
): { ok: true; value: UpdateInput } | { ok: false; errors: FieldErrors } {
  const patientName = readOptionalString(body, "patient_name", { maxLength: 255 });
  const mobile = readOptionalString(body, "mobile", { maxLength: 20 });
  const age = readOptionalInt(body, "age", { min: 0, max: 150 });
  const gender = readGender(body, false);
  const bloodGroup = readBloodGroup(body, false);
  const address = readOptionalString(body, "address", { allowBlank: true });
  const chiefComplaint = readOptionalString(body, "chief_complaint");

  const errors = collectFieldErrors({
    patient_name: patientName,
    mobile,
    age,
    gender,
    blood_group: bloodGroup,
    address,
    chief_complaint: chiefComplaint,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  const patch: UpdateInput = {};
  if (patientName.value !== undefined) {
    patch.patient_name = patientName.value;
  }
  if (mobile.value !== undefined) {
    patch.mobile = mobile.value;
  }
  if (age.value !== undefined) {
    patch.age = age.value;
  }
  if (gender.value) {
    patch.gender = gender.value;
  }
  if (bloodGroup.value !== undefined) {
    patch.blood_group = bloodGroup.value;
  }
  if (address.value !== undefined) {
    patch.address = address.value;
  }
  if (chiefComplaint.value !== undefined) {
    patch.chief_complaint = chiefComplaint.value;
  }
  return { ok: true, value: patch };
}

const listPatients: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const filter = buildPatientListFilter(req.query as Record<string, unknown>);
  const total = await Patient.countDocuments(filter).exec();
  const patients = await Patient.find(filter)
    .sort({ created_at: -1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Patients retrieved successfully.",
    results: patients.map(serializePatient),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const createPatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateCreate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }

  const user = req.user;
  if (!user) {
    return;
  }

  const identity = await resolveCreateIdentity({
    mobile: parsed.value.mobile,
    patientId: parsed.value.patient_id,
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    try {
      const objectId = identity.patientId ? undefined : newPatientObjectId();
      const patientId = identity.patientId ?? String(objectId);
      const patient = await Patient.create({
        ...(objectId ? { _id: objectId } : {}),
        patient_id: patientId,
        token_number: await generateTokenNumber(),
        visit_number: identity.visitNumber,
        patient_name: parsed.value.patient_name,
        mobile: parsed.value.mobile,
        age: parsed.value.age,
        gender: parsed.value.gender,
        blood_group: parsed.value.blood_group,
        address: parsed.value.address,
        chief_complaint: parsed.value.chief_complaint,
        status: "WAITING",
        created_by: user.id,
        created_by_name: user.full_name,
      });
      const subject = patientNotificationSubject(patient);
      if (subject) {
        const deskCopy =
          subject.visitNumber > 1
            ? returningPatientMessage(subject.name, subject.token, subject.visitNumber)
            : newPatientMessage(subject.name, subject.token, subject.visitNumber);
        await notifyIfEnabled("patient_registration", {
          type: NotificationType.PATIENT,
          ...deskCopy,
          related_id: `pr:${String(patient._id)}`,
          patient_name: subject.name,
          token_number: subject.token,
          visit_number: subject.visitNumber,
          roles: RECEPTIONIST_ROLES,
        });
        await notifyQueueWaiting(subject, String(patient._id));
      }
      successResponse(res, {
        statusCode: 201,
        message: "Patient registered successfully.",
        data: { patient: serializePatient(patient) },
      });
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
};

const getPatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const patient = await findPatientOr404(String(req.params["pk"] ?? ""), res);
  if (!patient) {
    return;
  }
  successResponse(res, {
    message: "Patient retrieved successfully.",
    data: { patient: serializePatient(patient) },
  });
};

const updatePatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const patient = await findPatientOr404(String(req.params["pk"] ?? ""), res);
  if (!patient) {
    return;
  }

  const parsed = validateUpdate(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }

  const user = req.user;
  if (user?.role === UserRole.RECEPTIONIST && patient.status !== "WAITING") {
    const errors: FieldErrors = { non_field_errors: [EDIT_LOCKED] };
    validationErrorResponse(res, errors);
    return;
  }

  if (parsed.value.patient_name !== undefined) {
    patient.patient_name = parsed.value.patient_name;
  }
  if (parsed.value.mobile !== undefined) {
    patient.mobile = parsed.value.mobile;
  }
  if (parsed.value.age !== undefined) {
    patient.age = parsed.value.age;
  }
  if (parsed.value.gender !== undefined) {
    patient.gender = parsed.value.gender;
  }
  if (parsed.value.blood_group !== undefined) {
    patient.blood_group = parsed.value.blood_group;
  }
  if (parsed.value.address !== undefined) {
    patient.address = parsed.value.address;
  }
  if (parsed.value.chief_complaint !== undefined) {
    patient.chief_complaint = parsed.value.chief_complaint;
  }
  await patient.save();

  successResponse(res, {
    message: "Patient updated successfully.",
    data: { patient: serializePatient(patient) },
  });
};

const deletePatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const patient = await findPatientOr404(String(req.params["pk"] ?? ""), res);
  if (!patient) {
    return;
  }
  await patient.deleteOne();
  successResponse(res, { message: "Patient deleted successfully." });
};

const getStats: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  successResponse(res, {
    message: "Patient stats retrieved successfully.",
    data: await getPatientStats(),
  });
};

function serializeLookupIdentity(identity: PatientIdentity) {
  return {
    found: true,
    multiple: false,
    mobile: identity.mobile,
    patient_id: identity.patientId,
    visit_count: identity.visitCount,
    next_visit_number: identity.visitCount + 1,
    patient: {
      patient_name: identity.latest.patient_name,
      age: identity.latest.age,
      gender: identity.latest.gender,
      blood_group: identity.latest.blood_group || "",
      address: identity.latest.address || "",
    },
    visits: identity.visits.map((visit) => ({
      id: String(visit._id),
      patient_id: identity.patientId,
      visit_number: visit.visit_number || 1,
      token_number: formatTokenForDisplay(visit.token_number),
      status: visit.status,
      chief_complaint: visit.chief_complaint || "",
      created_at: toDjangoIso(visit.created_at),
    })),
  };
}

function serializeLookupMatches(identities: PatientIdentity[]) {
  return {
    found: true,
    multiple: true,
    match_count: identities.length,
    matches: identities.map((identity) => ({
      patient_id: identity.patientId,
      patient_name: identity.latest.patient_name,
      mobile_masked: maskMobile(identity.mobile),
      last_visit: toDjangoIso(identity.latest.created_at),
      visit_count: identity.visitCount,
      next_visit_number: identity.visitCount + 1,
    })),
  };
}

const lookupPatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const classified = classifyLookupQuery(readQueryString(req.query.q));
  const mobile = readQueryString(req.query.mobile) || classified.mobile || "";
  const patientId = readQueryString(req.query.patient_id) || classified.patientId || "";
  const patientName =
    readQueryString(req.query.patient_name) ||
    readQueryString(req.query.name) ||
    classified.patientName ||
    "";

  if (!mobile && !patientId && !patientName) {
    errorResponse(res, {
      message: "Enter a mobile number or patient name.",
      statusCode: 400,
    });
    return;
  }

  const identities = await searchPatientIdentities({ mobile, patientId, patientName });
  if (identities.length === 0) {
    successResponse(res, {
      message: mobile
        ? patientName
          ? "No previous visits found for this mobile number and name."
          : "No previous visits found for this mobile number."
        : patientId
          ? "No previous visits found for this Patient ID."
          : "No previous visits found for this patient name.",
      data: {
        found: false,
        ...(mobile ? { mobile } : {}),
        ...(patientId && !mobile ? { patient_id: patientId } : {}),
        ...(patientName ? { patient_name: patientName } : {}),
        visit_count: 0,
        next_visit_number: 1,
      },
    });
    return;
  }

  if (identities.length === 1) {
    const identity = identities[0];
    if (!identity) {
      return;
    }
    successResponse(res, {
      message: "Returning patient found.",
      data: serializeLookupIdentity(identity),
    });
    return;
  }

  successResponse(res, {
    message: "Multiple patients found. Select a patient to continue.",
    data: serializeLookupMatches(identities),
  });
};

const patientRouter = Router();

patientRouter.get("/", authenticate, canViewPatients, listPatients);
patientRouter.post("/", authenticate, canCreatePatients, createPatient);
patientRouter.get("/stats/", authenticate, canViewPatients, getStats);
patientRouter.get("/stats", authenticate, canViewPatients, getStats);
patientRouter.get("/lookup/", authenticate, canViewPatients, lookupPatient);
patientRouter.get("/lookup", authenticate, canViewPatients, lookupPatient);
patientRouter.get("/:pk/", authenticate, canViewPatients, getPatient);
patientRouter.get("/:pk", authenticate, canViewPatients, getPatient);
patientRouter.put("/:pk/", authenticate, canUpdatePatients, updatePatient);
patientRouter.put("/:pk", authenticate, canUpdatePatients, updatePatient);
patientRouter.delete("/:pk/", authenticate, canDeletePatients, deletePatient);
patientRouter.delete("/:pk", authenticate, canDeletePatients, deletePatient);

export default patientRouter;
