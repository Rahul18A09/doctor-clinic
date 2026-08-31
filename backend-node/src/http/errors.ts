export type FieldErrors = Record<string, string[]>;

export const PermissionMessage = {
  admin: "Admin access required.",
  receptionist: "Receptionist access required.",
  authenticationRequired: "Authentication required.",
  viewPatients: "You do not have permission to view patients.",
  createPatients: "You do not have permission to register patients.",
  updatePatients: "You do not have permission to update patients.",
  deletePatients: "Only administrators can delete patients.",
  viewNotifications: "You do not have permission to view notifications.",
} as const;

export class InvalidPaginationError extends Error {
  override readonly name = "InvalidPaginationError";

  constructor(message = "Invalid pagination parameter.") {
    super(message);
  }
}

/**
 * DRF-style: first list error string in field-error map order.
 * Used as `message` on enveloped 400s.
 */
export function firstErrorMessage(
  errors: FieldErrors,
  fallback: string,
): string {
  for (const messages of Object.values(errors)) {
    if (Array.isArray(messages) && messages[0]) {
      return messages[0];
    }
  }
  return fallback;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function mergeFieldErrors(...groups: FieldErrors[]): FieldErrors {
  const merged: FieldErrors = {};
  for (const group of groups) {
    for (const [field, messages] of Object.entries(group)) {
      if (!messages || messages.length === 0) {
        continue;
      }
      merged[field] = [...(merged[field] ?? []), ...messages];
    }
  }
  return merged;
}
