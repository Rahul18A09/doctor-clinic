export const UserRole = {
  ADMIN: "ADMIN",
  RECEPTIONIST: "RECEPTIONIST",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.RECEPTIONIST];

export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDERS: Gender[] = [Gender.MALE, Gender.FEMALE, Gender.OTHER];

export const PatientStatus = {
  WAITING: "WAITING",
  IN_CONSULTATION: "IN_CONSULTATION",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type PatientStatus = (typeof PatientStatus)[keyof typeof PatientStatus];

export const PATIENT_STATUSES: PatientStatus[] = [
  PatientStatus.WAITING,
  PatientStatus.IN_CONSULTATION,
  PatientStatus.COMPLETED,
  PatientStatus.CANCELLED,
];

export const BloodGroup = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
} as const;

export type BloodGroup = (typeof BloodGroup)[keyof typeof BloodGroup];

export const BLOOD_GROUPS: BloodGroup[] = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
];

export const NotificationType = {
  PATIENT: "patient",
  TOKEN: "token",
  QUEUE: "queue",
  CONSULTATION: "consultation",
  STAFF: "staff",
  SYSTEM: "system",
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Stored in older documents before the type was renamed to `staff`. */
export const LEGACY_NOTIFICATION_TYPE_RECEPTIONIST = "receptionist";

export const PUBLIC_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PATIENT,
  NotificationType.TOKEN,
  NotificationType.QUEUE,
  NotificationType.CONSULTATION,
  NotificationType.STAFF,
  NotificationType.SYSTEM,
];

export const NOTIFICATION_TYPES: string[] = [
  ...PUBLIC_NOTIFICATION_TYPES,
  LEGACY_NOTIFICATION_TYPE_RECEPTIONIST,
];
