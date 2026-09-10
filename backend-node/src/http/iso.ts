/**
 * Serialize a Date as ISO 8601 UTC with timezone marker (e.g. 2026-09-10T04:46:00.000Z).
 * MongoDB stores UTC; the API must expose that explicitly so clients do not treat UTC as local.
 */
export function toIsoUtc(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
