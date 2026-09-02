import { BedStatus, NotificationType } from "../constants";
import { findRoomById } from "../beds/operations";
import { Patient } from "../models/patient.model";
import type { BedDocument } from "../models/bed.model";
import {
  admissionRequiredMessage,
  bedAssignedMessage,
  bedMaintenanceMessage,
  bedReleasedMessage,
  patientNotificationSubject,
} from "./messages";
import { ADMIN_ROLES, CLINIC_ROLES, notifyStaffSafe } from "./notifyStaff";

function bedRelatedId(prefix: "ba" | "br", patientId: string, bedId: string): string {
  return `${prefix}:${patientId}:${bedId}`.slice(0, 64);
}

async function roomLabel(roomId: string): Promise<string | null> {
  const room = await findRoomById(roomId);
  const number = room?.room_number?.trim();
  return number || null;
}

async function visitSubject(patientId: string) {
  const patient = await Patient.findById(patientId)
    .select({ patient_name: 1, token_number: 1, visit_number: 1 })
    .exec();
  if (!patient) {
    return null;
  }
  return patientNotificationSubject(patient);
}

export async function notifyBedAssigned(bed: BedDocument): Promise<void> {
  const patientId = bed.patient_id;
  if (!patientId) {
    return;
  }
  const [subject, roomNumber] = await Promise.all([
    visitSubject(patientId),
    roomLabel(bed.room_id),
  ]);
  if (!subject || !roomNumber) {
    return;
  }
  await notifyStaffSafe({
    type: NotificationType.PATIENT,
    ...bedAssignedMessage(subject.name, subject.token, subject.visitNumber, roomNumber, bed.bed_number),
    related_id: bedRelatedId("ba", patientId, String(bed._id)),
    patient_name: subject.name,
    token_number: subject.token,
    visit_number: subject.visitNumber,
    roles: CLINIC_ROLES,
  });
}

export async function notifyBedReleased(
  bed: BedDocument,
  previousPatientId: string | null | undefined,
): Promise<void> {
  if (!previousPatientId) {
    return;
  }
  const [subject, roomNumber] = await Promise.all([
    visitSubject(previousPatientId),
    roomLabel(bed.room_id),
  ]);
  if (!subject || !roomNumber) {
    return;
  }
  await notifyStaffSafe({
    type: NotificationType.PATIENT,
    ...bedReleasedMessage(subject.name, subject.token, subject.visitNumber, roomNumber, bed.bed_number),
    related_id: bedRelatedId("br", previousPatientId, String(bed._id)),
    patient_name: subject.name,
    token_number: subject.token,
    visit_number: subject.visitNumber,
    roles: CLINIC_ROLES,
  });
}

export async function notifyBedMaintenance(bed: BedDocument): Promise<void> {
  const roomNumber = await roomLabel(bed.room_id);
  if (!roomNumber) {
    return;
  }
  await notifyStaffSafe({
    type: NotificationType.STAFF,
    ...bedMaintenanceMessage(roomNumber, bed.bed_number),
    related_id: `bm:${String(bed._id)}`.slice(0, 64),
    roles: ADMIN_ROLES,
  });
}

export async function notifyIfMaintenanceStarted(
  previousStatus: string,
  bed: BedDocument,
): Promise<void> {
  if (bed.status === BedStatus.MAINTENANCE && previousStatus !== BedStatus.MAINTENANCE) {
    await notifyBedMaintenance(bed);
  }
}

export async function notifyAdmissionRequired(patientId: string): Promise<void> {
  const subject = await visitSubject(patientId);
  if (!subject) {
    return;
  }
  await notifyStaffSafe({
    type: NotificationType.PATIENT,
    ...admissionRequiredMessage(subject.name, subject.token, subject.visitNumber),
    related_id: `ar:${patientId}`.slice(0, 64),
    patient_name: subject.name,
    token_number: subject.token,
    visit_number: subject.visitNumber,
    roles: CLINIC_ROLES,
  });
}
