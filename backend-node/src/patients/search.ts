import { escapeRegex, icontainsRegex, isMongoObjectId } from "../http/validation";

/**
 * Parse UI / API token search into a numeric sequence.
 * Accepts `01`, `3`, `0003`, `P0003`, `P3`, and `YYYYMMDD-P0003`.
 */
export function parseTokenSearchSequence(search: string): number | null {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const dated = /^(\d{8})-P(\d+)$/i.exec(trimmed);
  if (dated?.[2]) {
    const sequence = Number.parseInt(dated[2], 10);
    return Number.isFinite(sequence) ? sequence : null;
  }

  const prefixed = /^P(\d+)$/i.exec(trimmed);
  if (prefixed?.[1]) {
    const sequence = Number.parseInt(prefixed[1], 10);
    return Number.isFinite(sequence) ? sequence : null;
  }

  // Short numeric display tokens (UI shows 01, 02, …) — not phone numbers.
  if (/^\d{1,4}$/.test(trimmed)) {
    const sequence = Number.parseInt(trimmed, 10);
    return Number.isFinite(sequence) ? sequence : null;
  }

  return null;
}

function tokenNumberMatchClauses(sequence: number): Record<string, unknown>[] {
  const padded = String(sequence).padStart(4, "0");
  const suffix = escapeRegex(`P${padded}`);
  return [
    { token_number: { $regex: `-${suffix}$`, $options: "i" } },
    { token_number: { $regex: `^${suffix}$`, $options: "i" } },
  ];
}

export type PatientSearchOptions = {
  /** Include patient_id substring match for free-text / ObjectId queries (patient list). */
  includePatientId?: boolean;
};

/**
 * Build Mongo `$or` clauses so token, phone, and name search do not collide.
 * - Token-like (`01`, `P0003`, …) → token_number suffix only
 * - Phone-like (5–15 digits) → mobile only
 * - ObjectId → patient_id (when enabled)
 * - Otherwise → patient_name (and optional patient_id)
 */
export function buildPatientSearchOrClauses(
  search: string,
  options: PatientSearchOptions = {},
): Record<string, unknown>[] {
  const trimmed = search.trim();
  if (!trimmed) {
    return [];
  }

  const tokenSequence = parseTokenSearchSequence(trimmed);
  if (tokenSequence != null) {
    return tokenNumberMatchClauses(tokenSequence);
  }

  if (/^\d{5,15}$/.test(trimmed)) {
    return [{ mobile: icontainsRegex(trimmed) }];
  }

  if (options.includePatientId && isMongoObjectId(trimmed)) {
    return [{ patient_id: trimmed }];
  }

  const pattern = icontainsRegex(trimmed);
  const clauses: Record<string, unknown>[] = [{ patient_name: pattern }];
  if (options.includePatientId) {
    clauses.push({ patient_id: pattern });
  }
  return clauses;
}
