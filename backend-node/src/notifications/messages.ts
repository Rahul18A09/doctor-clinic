import { formatTokenForDisplay } from "../patients/tokens";

/** Shared Mongo/JS pattern for leftover test, stamp, and ObjectId text. */
export const INTERNAL_NOTIFICATION_TEXT_RE =
  /\bNode\b|node\.(pat|doc|notify|rcpt|auth|queue|settings)\.|\b[a-f0-9]{24}\b|\b\d{13}\b|\bNotify (Admin|Desk|Patient|Other|Tester)\b|\bSettings (Admin|Receptionist)\b|\b(Pat Stats|Rcpt Updated|Pat Admin|Pat Desk)\b|^(Admin patient note|Desk token note|Admin system note|Extra unread|Delete me)\b/i;

export const INTERNAL_NOTIFICATION_MONGO_RE =
  "\\bNode\\b|node\\.(pat|doc|notify|rcpt|auth|queue|settings)\\.|\\b[a-f0-9]{24}\\b|\\b\\d{13}\\b|\\bNotify (Admin|Desk|Patient|Other|Tester)\\b|\\bSettings (Admin|Receptionist)\\b|\\b(Pat Stats|Rcpt Updated|Pat Admin|Pat Desk)\\b|^(Admin patient note|Desk token note|Admin system note|Extra unread|Delete me)\\b";

export function displayPersonName(name: string | null | undefined): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

export function containsInternalTestValue(value: string | null | undefined): boolean {
  const text = displayPersonName(value);
  return text.length > 0 && INTERNAL_NOTIFICATION_TEXT_RE.test(text);
}

export function isInternalDisplayName(name: string | null | undefined): boolean {
  return containsInternalTestValue(name);
}

export function isInternalNotificationText(title: string, message: string): boolean {
  return containsInternalTestValue(`${title} ${message}`);
}

/** UI-style token: stored `P0008` / `YYYYMMDD-P0008` → `0008`. Never returns a raw ObjectId. */
export function formatNotificationToken(storedToken: string | null | undefined): string {
  const raw = String(storedToken ?? "").trim();
  if (!raw || containsInternalTestValue(raw) || /^[a-f0-9]{24}$/i.test(raw)) {
    return "";
  }
  const display = formatTokenForDisplay(raw);
  const digits = display.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const sequence = Number.parseInt(digits, 10);
  if (!Number.isFinite(sequence) || sequence < 1) {
    return "";
  }
  return String(sequence).padStart(4, "0");
}

export function formatNotificationWhen(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

export type PatientNotificationSubject = {
  name: string;
  token: string;
  visitNumber: number;
};

/** Reads the clinic display fields from a Patient visit document. */
export function patientNotificationSubject(patient: {
  patient_name?: string | null;
  token_number?: string | null;
  visit_number?: number | null;
}): PatientNotificationSubject | null {
  const name = displayPersonName(patient.patient_name);
  const token = formatNotificationToken(patient.token_number);
  const visitNumber = Number(patient.visit_number);
  if (!name || !token || isInternalDisplayName(name) || !Number.isFinite(visitNumber) || visitNumber < 1) {
    return null;
  }
  return { name, token, visitNumber: Math.trunc(visitNumber) };
}

export function newPatientMessage(
  name: string,
  token: string,
  visitNumber = 1,
): { title: string; message: string } {
  return {
    title: "New patient registered",
    message: `${name} has been registered for visit #${visitNumber} with token ${token}.`,
  };
}

export function returningPatientMessage(
  name: string,
  token: string,
  visitNumber: number,
): { title: string; message: string } {
  return {
    title: "Returning patient",
    message: `${name} has returned for visit #${visitNumber} with token ${token}.`,
  };
}

export function newPatientWaitingMessage(
  name: string,
  token: string,
  visitNumber = 1,
): { title: string; message: string } {
  return {
    title: "New patient waiting",
    message: `${name} is waiting for consultation (visit #${visitNumber}, token ${token}).`,
  };
}

export function returningPatientWaitingMessage(
  name: string,
  token: string,
  visitNumber: number,
): { title: string; message: string } {
  return {
    title: "Returning patient waiting",
    message: `${name} is waiting for consultation (visit #${visitNumber}, token ${token}).`,
  };
}

export function consultationStartedMessage(
  name: string,
  token: string,
  visitNumber: number,
): { title: string; message: string } {
  return {
    title: "Consultation started",
    message: `Consultation for ${name} (visit #${visitNumber}, token ${token}) has started.`,
  };
}

export function consultationCompletedMessage(
  name: string,
  token: string,
  visitNumber: number,
  when: Date = new Date(),
): { title: string; message: string } {
  return {
    title: "Consultation completed",
    message: `Consultation for ${name} (visit #${visitNumber}, token ${token}) was completed on ${formatNotificationWhen(when)}.`,
  };
}

export function consultationCancelledMessage(
  name: string,
  token: string,
  visitNumber: number,
  when: Date = new Date(),
): { title: string; message: string } {
  return {
    title: "Consultation cancelled",
    message: `Consultation for ${name} (visit #${visitNumber}, token ${token}) was cancelled on ${formatNotificationWhen(when)}.`,
  };
}

export function bedAssignedMessage(
  name: string,
  token: string,
  visitNumber: number,
  roomNumber: string,
  bedNumber: string,
): { title: string; message: string } {
  return {
    title: "Bed assigned",
    message: `${name} was assigned to bed ${bedNumber} in room ${roomNumber} (visit #${visitNumber}, token ${token}).`,
  };
}

export function bedReleasedMessage(
  name: string,
  token: string,
  visitNumber: number,
  roomNumber: string,
  bedNumber: string,
): { title: string; message: string } {
  return {
    title: "Bed released",
    message: `${name} was released from bed ${bedNumber} in room ${roomNumber} (visit #${visitNumber}, token ${token}).`,
  };
}

export function bedMaintenanceMessage(
  roomNumber: string,
  bedNumber: string,
): { title: string; message: string } {
  return {
    title: "Bed marked for maintenance",
    message: `Bed ${bedNumber} in room ${roomNumber} was marked for maintenance.`,
  };
}

export function admissionRequiredMessage(
  name: string,
  token: string,
  visitNumber: number,
): { title: string; message: string } {
  return {
    title: "Admission pending",
    message: `${name} has admission pending (visit #${visitNumber}, token ${token}).`,
  };
}

export function receptionistAddedMessage(name: string): { title: string; message: string } {
  return {
    title: "Receptionist added",
    message: `${name} has been added as a receptionist.`,
  };
}

export function receptionistActivatedMessage(name: string): { title: string; message: string } {
  return {
    title: "Receptionist activated",
    message: `${name}'s receptionist account has been activated.`,
  };
}

export function receptionistDeactivatedMessage(name: string): { title: string; message: string } {
  return {
    title: "Receptionist deactivated",
    message: `${name}'s receptionist account has been deactivated.`,
  };
}
