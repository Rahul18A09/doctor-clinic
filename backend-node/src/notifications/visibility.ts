import {
  LEGACY_NOTIFICATION_TYPE_RECEPTIONIST,
  NotificationType,
  PUBLIC_NOTIFICATION_TYPES,
  UserRole,
  type NotificationType as NotificationTypeValue,
} from "../constants";
import { INTERNAL_NOTIFICATION_MONGO_RE } from "./messages";

export const RECEPTIONIST_NOTIFICATION_TYPES: NotificationTypeValue[] = [
  NotificationType.PATIENT,
  NotificationType.CONSULTATION,
];

export function typesVisibleToRole(role: UserRole): string[] {
  if (role === UserRole.ADMIN) {
    return [...PUBLIC_NOTIFICATION_TYPES, LEGACY_NOTIFICATION_TYPE_RECEPTIONIST];
  }
  return [...RECEPTIONIST_NOTIFICATION_TYPES];
}

export function expandRequestedType(type: string): string[] {
  if (type === NotificationType.STAFF || type === LEGACY_NOTIFICATION_TYPE_RECEPTIONIST) {
    return [NotificationType.STAFF, LEGACY_NOTIFICATION_TYPE_RECEPTIONIST];
  }
  return [type];
}

export function normalizeStoredType(type: string): NotificationTypeValue {
  if (type === LEGACY_NOTIFICATION_TYPE_RECEPTIONIST) {
    return NotificationType.STAFF;
  }
  if ((PUBLIC_NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    return type as NotificationTypeValue;
  }
  return NotificationType.SYSTEM;
}

export function visibleNotificationMongoFilter(role: UserRole): Record<string, unknown> {
  return {
    type: { $in: typesVisibleToRole(role) },
    $nor: [
      { title: { $regex: INTERNAL_NOTIFICATION_MONGO_RE, $options: "i" } },
      { message: { $regex: INTERNAL_NOTIFICATION_MONGO_RE, $options: "i" } },
    ],
  };
}
