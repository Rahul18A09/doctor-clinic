import { NotificationType, UserRole, type NotificationType as NotificationTypeValue, type UserRole as Role } from "../constants";
import { getOrCreateSettings } from "../models/settings.model";
import { Notification } from "../models/notification.model";
import { User } from "../models/user.model";
import type { NotificationSettings } from "../settings/defaults";
import {
  isInternalNotificationText,
  newPatientWaitingMessage,
  returningPatientWaitingMessage,
  type PatientNotificationSubject,
} from "./messages";

export const CLINIC_ROLES: Role[] = [UserRole.ADMIN, UserRole.RECEPTIONIST];
export const ADMIN_ROLES: Role[] = [UserRole.ADMIN];
export const RECEPTIONIST_ROLES: Role[] = [UserRole.RECEPTIONIST];

export type StaffNotificationInput = {
  type: NotificationTypeValue;
  title: string;
  message: string;
  related_id?: string;
  patient_name?: string;
  token_number?: string;
  visit_number?: number;
  roles?: readonly Role[];
  excludeUserId?: string;
};

async function recipientIds(roles: readonly Role[]): Promise<string[]> {
  const users = await User.find({
    is_active: true,
    is_deleted: false,
    role: { $in: [...roles] },
  })
    .select({ _id: 1, full_name: 1, email: 1 })
    .exec();
  return users.map((user) => String(user._id));
}

export async function notifyStaff(input: StaffNotificationInput): Promise<number> {
  if (isInternalNotificationText(input.title, input.message)) {
    return 0;
  }
  const roles = input.roles && input.roles.length > 0 ? input.roles : CLINIC_ROLES;
  let userIds = await recipientIds(roles);
  if (input.excludeUserId) {
    userIds = userIds.filter((userId) => userId !== input.excludeUserId);
  }
  if (input.related_id && userIds.length > 0) {
    const existing = await Notification.find({
      related_id: input.related_id,
      user_id: { $in: userIds },
    })
      .select({ user_id: 1 })
      .lean()
      .exec();
    const alreadyNotified = new Set(existing.map((row) => row.user_id));
    userIds = userIds.filter((userId) => !alreadyNotified.has(userId));
  }
  if (userIds.length === 0) {
    return 0;
  }
  const now = new Date();
  const docs = userIds.map((user_id) => ({
    user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    is_read: false,
    related_id: input.related_id,
    patient_name: input.patient_name,
    token_number: input.token_number,
    visit_number: input.visit_number,
    created_at: now,
    updated_at: now,
  }));
  const created = await Notification.insertMany(docs);
  return created.length;
}

export async function notifyIfEnabled(
  settingKey: keyof NotificationSettings,
  input: StaffNotificationInput,
): Promise<number> {
  try {
    const settings = await getOrCreateSettings();
    if (!settings.notifications[settingKey]) {
      return 0;
    }
    return await notifyStaff(input);
  } catch (error) {
    console.error("Failed to create notifications:", error);
    return 0;
  }
}

export async function notifyStaffSafe(input: StaffNotificationInput): Promise<number> {
  try {
    return await notifyStaff(input);
  } catch (error) {
    console.error("Failed to create notifications:", error);
    return 0;
  }
}

export function queueRelatedId(patientId: string): string {
  return `q:${patientId}`.slice(0, 64);
}

export async function resolveQueueNotifications(patientId: string): Promise<number> {
  const result = await Notification.deleteMany({
    type: NotificationType.QUEUE,
    related_id: queueRelatedId(patientId),
  }).exec();
  return result.deletedCount ?? 0;
}

export async function notifyQueueWaiting(
  subject: PatientNotificationSubject,
  patientId: string,
  options: { gated?: boolean } = {},
): Promise<number> {
  const copy =
    subject.visitNumber > 1
      ? returningPatientWaitingMessage(subject.name, subject.token, subject.visitNumber)
      : newPatientWaitingMessage(subject.name, subject.token, subject.visitNumber);
  const input: StaffNotificationInput = {
    type: NotificationType.QUEUE,
    ...copy,
    related_id: queueRelatedId(patientId),
    patient_name: subject.name,
    token_number: subject.token,
    visit_number: subject.visitNumber,
    roles: ADMIN_ROLES,
  };
  if (options.gated === false) {
    return notifyStaffSafe(input);
  }
  return notifyIfEnabled("patient_registration", input);
}
