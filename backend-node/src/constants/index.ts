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

export const RoomType = {
  GENERAL: "GENERAL",
  PRIVATE: "PRIVATE",
  SEMI_PRIVATE: "SEMI_PRIVATE",
  ICU: "ICU",
  EMERGENCY: "EMERGENCY",
  WARD: "WARD",
  OTHER: "OTHER",
} as const;

export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const ROOM_TYPES: RoomType[] = [
  RoomType.GENERAL,
  RoomType.PRIVATE,
  RoomType.SEMI_PRIVATE,
  RoomType.ICU,
  RoomType.EMERGENCY,
  RoomType.WARD,
  RoomType.OTHER,
];

export const BedStatus = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  MAINTENANCE: "maintenance",
  BLOCKED: "blocked",
} as const;

export type BedStatus = (typeof BedStatus)[keyof typeof BedStatus];

export const BED_STATUSES: BedStatus[] = [
  BedStatus.AVAILABLE,
  BedStatus.OCCUPIED,
  BedStatus.RESERVED,
  BedStatus.MAINTENANCE,
  BedStatus.BLOCKED,
];

/** Beds a patient may be assigned onto. */
export const ASSIGNABLE_BED_STATUSES: BedStatus[] = [BedStatus.AVAILABLE];

/** Statuses that count as an active assignment for a patient. */
export const ACTIVE_BED_ASSIGNMENT_STATUSES: BedStatus[] = [
  BedStatus.OCCUPIED,
  BedStatus.RESERVED,
];

export const CareType = {
  OUTPATIENT: "Outpatient",
  INPATIENT: "Inpatient",
} as const;

export type CareType = (typeof CareType)[keyof typeof CareType];

export const CARE_TYPES: CareType[] = [CareType.OUTPATIENT, CareType.INPATIENT];

export const AdmissionStatus = {
  NOT_REQUIRED: "Not Required",
  PENDING: "Pending",
  ADMITTED: "Admitted",
  DISCHARGED: "Discharged",
} as const;

export type AdmissionStatus = (typeof AdmissionStatus)[keyof typeof AdmissionStatus];

/** Stored on older inpatient visits before Admission Required was renamed to Pending. */
export const LEGACY_ADMISSION_REQUIRED = "Admission Required";

export const ADMISSION_PENDING_VALUES: readonly string[] = [
  AdmissionStatus.PENDING,
  LEGACY_ADMISSION_REQUIRED,
];

export const ADMISSION_STATUSES: string[] = [
  AdmissionStatus.NOT_REQUIRED,
  AdmissionStatus.PENDING,
  AdmissionStatus.ADMITTED,
  AdmissionStatus.DISCHARGED,
  LEGACY_ADMISSION_REQUIRED,
];

export function isAdmissionPending(status?: string | null): boolean {
  return status === AdmissionStatus.PENDING || status === LEGACY_ADMISSION_REQUIRED;
}

export function normalizeAdmissionStatus(
  careType?: string | null,
  admissionStatus?: string | null,
): string {
  if (isAdmissionPending(admissionStatus)) {
    return AdmissionStatus.PENDING;
  }
  if (admissionStatus) {
    return admissionStatus;
  }
  if (careType === CareType.OUTPATIENT) {
    return AdmissionStatus.NOT_REQUIRED;
  }
  return "";
}
