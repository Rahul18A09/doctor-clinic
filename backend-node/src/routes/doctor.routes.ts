import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { NotificationType, PatientStatus } from "../constants";
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
  isMongoObjectId,
  readBody,
  readOptionalNullableFloat,
  readOptionalString,
  readQueryString,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/authorize";
import { Patient, type PatientDocument } from "../models/patient.model";
import {
  consultationCancelledMessage,
  consultationCompletedMessage,
  consultationStartedMessage,
  patientNotificationSubject,
} from "../notifications/messages";
import {
  CLINIC_ROLES,
  RECEPTIONIST_ROLES,
  notifyIfEnabled,
  notifyQueueWaiting,
  notifyStaffSafe,
  resolveQueueNotifications,
} from "../notifications/notifyStaff";
import { buildDoctorListFilter, doctorListSort } from "../patients/doctorFilters";
import { serializePatient } from "../patients/serializePatient";
import { getPatientStats } from "../patients/stats";
import { findVisitByPublicId } from "../patients/visits";

const NOT_FOUND = "Patient not found.";
const START_GUARD =
  "Consultation can only be started for patients with WAITING status.";
const SAVE_GUARD =
  "Consultation data can only be saved while status is IN_CONSULTATION.";
const COMPLETE_GUARD =
  "Only waiting or in-consultation patients can be completed.";
const CANCEL_GUARD = "Only in-progress consultations can be cancelled.";

const adminOnly = [authenticate, requireAdmin] as const;

async function loadPatientOr404(
  pk: string,
  res: Response,
): Promise<PatientDocument | null> {
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  const patient = await findVisitByPublicId(pk);
  if (!patient) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  return patient;
}

function statusConflict(res: Response, message: string): void {
  errorResponse(res, { message, statusCode: 400 });
}

function validateConsultationSave(
  body: Record<string, unknown>,
): { ok: true; patch: Record<string, unknown> } | { ok: false; errors: FieldErrors } {
  const temperature = readOptionalNullableFloat(body, "temperature");
  const bloodPressure = readOptionalString(body, "blood_pressure", {
    maxLength: 20,
    allowBlank: true,
  });
  const pulse = readOptionalString(body, "pulse", { maxLength: 20, allowBlank: true });
  const weight = readOptionalNullableFloat(body, "weight");
  const height = readOptionalNullableFloat(body, "height");
  const diagnosis = readOptionalString(body, "diagnosis", { allowBlank: true });
  const doctorNotes = readOptionalString(body, "doctor_notes", { allowBlank: true });
  const prescription = readOptionalString(body, "prescription", { allowBlank: true });

  const errors = collectFieldErrors({
    temperature,
    blood_pressure: bloodPressure,
    pulse,
    weight,
    height,
    diagnosis,
    doctor_notes: doctorNotes,
    prescription,
  });
  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  const patch: Record<string, unknown> = {};
  if (temperature.assigned) {
    patch["temperature"] = temperature.value ?? null;
  }
  if (bloodPressure.value !== undefined) {
    patch["blood_pressure"] = bloodPressure.value;
  }
  if (pulse.value !== undefined) {
    patch["pulse"] = pulse.value;
  }
  if (weight.assigned) {
    patch["weight"] = weight.value ?? null;
  }
  if (height.assigned) {
    patch["height"] = height.value ?? null;
  }
  if (diagnosis.value !== undefined) {
    patch["diagnosis"] = diagnosis.value;
  }
  if (doctorNotes.value !== undefined) {
    patch["doctor_notes"] = doctorNotes.value;
  }
  if (prescription.value !== undefined) {
    patch["prescription"] = prescription.value;
  }
  return { ok: true, patch };
}

const listDoctorPatients: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parsePagination(req.query);
  const query = req.query as Record<string, unknown>;
  const filter = buildDoctorListFilter(query);
  const statusFilter = readQueryString(query["status"]);
  const total = await Patient.countDocuments(filter).exec();
  const patients = await Patient.find(filter)
    .sort(doctorListSort(statusFilter))
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Patients retrieved successfully.",
    results: patients.map(serializePatient),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const listCompletedPatients: RequestHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = parsePagination(req.query);
  const search = readQueryString(req.query.search);
  const filter: Record<string, unknown> = { status: PatientStatus.COMPLETED };
  if (search) {
    const pattern = icontainsRegex(search);
    filter["$or"] = [
      { patient_name: pattern },
      { mobile: pattern },
      { token_number: pattern },
    ];
  }

  const total = await Patient.countDocuments(filter).exec();
  const patients = await Patient.find(filter)
    .sort({ consultation_completed_at: -1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Completed patients retrieved successfully.",
    results: patients.map(serializePatient),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const getDoctorPatient: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const patient = await loadPatientOr404(String(req.params["pk"] ?? ""), res);
  if (!patient) {
    return;
  }
  successResponse(res, {
    message: "Patient retrieved successfully.",
    data: { patient: serializePatient(patient) },
  });
};

const startConsultation: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return;
  }
  const user = req.user;
  if (!user) {
    return;
  }
  const now = new Date();
  const updated = await Patient.findOneAndUpdate(
    { _id: pk, status: PatientStatus.WAITING },
    {
      $set: {
        status: PatientStatus.IN_CONSULTATION,
        consultation_started_at: now,
        consulted_by: user.id,
        consulted_by_name: user.full_name,
        updated_at: now,
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    const existing = await Patient.findById(pk).exec();
    if (!existing) {
      notFoundResponse(res, NOT_FOUND);
      return;
    }
    statusConflict(res, START_GUARD);
    return;
  }

  await resolveQueueNotifications(String(updated._id));
  const started = patientNotificationSubject(updated);
  if (started) {
    await notifyStaffSafe({
      type: NotificationType.CONSULTATION,
      ...consultationStartedMessage(started.name, started.token, started.visitNumber),
      related_id: `cs:${String(updated._id)}:${now.getTime()}`,
      patient_name: started.name,
      token_number: started.token,
      visit_number: started.visitNumber,
      roles: RECEPTIONIST_ROLES,
    });
  }

  successResponse(res, {
    message: "Consultation started successfully.",
    data: { patient: serializePatient(updated) },
  });
};

const saveConsultation: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return;
  }
  const user = req.user;
  if (!user) {
    return;
  }

  const parsed = validateConsultationSave(readBody(req.body));
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors);
    return;
  }

  const now = new Date();
  const updated = await Patient.findOneAndUpdate(
    { _id: pk, status: PatientStatus.IN_CONSULTATION },
    {
      $set: {
        ...parsed.patch,
        updated_by: user.id,
        updated_by_name: user.full_name,
        updated_at: now,
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    const existing = await Patient.findById(pk).exec();
    if (!existing) {
      notFoundResponse(res, NOT_FOUND);
      return;
    }
    statusConflict(res, SAVE_GUARD);
    return;
  }

  successResponse(res, {
    message: "Consultation saved successfully.",
    data: { patient: serializePatient(updated) },
  });
};

const completeConsultation: RequestHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return;
  }
  const user = req.user;
  if (!user) {
    return;
  }
  const now = new Date();
  const completionFields = {
    status: PatientStatus.COMPLETED,
    consultation_completed_at: now,
    completed_at: now,
    updated_by: user.id,
    updated_by_name: user.full_name,
    updated_at: now,
  };

  const completeFromInConsultation = (): Promise<PatientDocument | null> =>
    Patient.findOneAndUpdate(
      { _id: pk, status: PatientStatus.IN_CONSULTATION },
      { $set: completionFields },
      { returnDocument: "after" },
    ).exec();

  const completeFromWaiting = (): Promise<PatientDocument | null> =>
    Patient.findOneAndUpdate(
      { _id: pk, status: PatientStatus.WAITING },
      {
        $set: {
          ...completionFields,
          consultation_started_at: now,
          consulted_by: user.id,
          consulted_by_name: user.full_name,
        },
      },
      { returnDocument: "after" },
    ).exec();

  let updated =
    (await completeFromInConsultation()) ?? (await completeFromWaiting());

  if (!updated) {
    const existing = await Patient.findById(pk).exec();
    if (!existing) {
      notFoundResponse(res, NOT_FOUND);
      return;
    }
    if (existing.status === PatientStatus.IN_CONSULTATION) {
      updated = await completeFromInConsultation();
    } else if (existing.status === PatientStatus.WAITING) {
      updated = await completeFromWaiting();
    }
  }

  if (!updated) {
    statusConflict(res, COMPLETE_GUARD);
    return;
  }

  const completed = patientNotificationSubject(updated);
  if (completed) {
    await resolveQueueNotifications(String(updated._id));
    await notifyIfEnabled("consultation_completed", {
      type: NotificationType.CONSULTATION,
      ...consultationCompletedMessage(completed.name, completed.token, completed.visitNumber, now),
      related_id: `cc:${String(updated._id)}`,
      patient_name: completed.name,
      token_number: completed.token,
      visit_number: completed.visitNumber,
      roles: CLINIC_ROLES,
    });
  }

  successResponse(res, {
    message: "Treatment completed successfully.",
    data: { patient: serializePatient(updated) },
  });
};

const cancelConsultation: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const pk = String(req.params["pk"] ?? "");
  if (!isMongoObjectId(pk)) {
    notFoundResponse(res, NOT_FOUND);
    return;
  }
  const user = req.user;
  if (!user) {
    return;
  }
  const now = new Date();
  const updated = await Patient.findOneAndUpdate(
    { _id: pk, status: PatientStatus.IN_CONSULTATION },
    {
      $set: {
        status: PatientStatus.WAITING,
        consultation_started_at: null,
        updated_at: now,
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!updated) {
    const existing = await Patient.findById(pk).exec();
    if (!existing) {
      notFoundResponse(res, NOT_FOUND);
      return;
    }
    statusConflict(res, CANCEL_GUARD);
    return;
  }

  const cancelled = patientNotificationSubject(updated);
  if (cancelled) {
    await notifyStaffSafe({
      type: NotificationType.CONSULTATION,
      ...consultationCancelledMessage(cancelled.name, cancelled.token, cancelled.visitNumber, now),
      related_id: `cx:${String(updated._id)}:${now.getTime()}`,
      patient_name: cancelled.name,
      token_number: cancelled.token,
      visit_number: cancelled.visitNumber,
      roles: CLINIC_ROLES,
    });
    await notifyQueueWaiting(cancelled, String(updated._id), { gated: false });
  }

  successResponse(res, {
    message: "Consultation cancelled. Patient returned to waiting queue.",
    data: { patient: serializePatient(updated) },
  });
};

const getDoctorStats: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  successResponse(res, {
    message: "Consultation stats retrieved successfully.",
    data: await getPatientStats(),
  });
};

export const doctorStatsRouter = Router();
doctorStatsRouter.get("/", ...adminOnly, getDoctorStats);

const doctorPatientsRouter = Router();
doctorPatientsRouter.get("/", ...adminOnly, listDoctorPatients);
doctorPatientsRouter.get("/completed/", ...adminOnly, listCompletedPatients);
doctorPatientsRouter.get("/completed", ...adminOnly, listCompletedPatients);
doctorPatientsRouter.post("/:pk/start/", ...adminOnly, startConsultation);
doctorPatientsRouter.post("/:pk/start", ...adminOnly, startConsultation);
doctorPatientsRouter.put("/:pk/consultation/", ...adminOnly, saveConsultation);
doctorPatientsRouter.put("/:pk/consultation", ...adminOnly, saveConsultation);
doctorPatientsRouter.post("/:pk/complete/", ...adminOnly, completeConsultation);
doctorPatientsRouter.post("/:pk/complete", ...adminOnly, completeConsultation);
doctorPatientsRouter.post("/:pk/cancel/", ...adminOnly, cancelConsultation);
doctorPatientsRouter.post("/:pk/cancel", ...adminOnly, cancelConsultation);
doctorPatientsRouter.get("/:pk/", ...adminOnly, getDoctorPatient);
doctorPatientsRouter.get("/:pk", ...adminOnly, getDoctorPatient);

export default doctorPatientsRouter;
