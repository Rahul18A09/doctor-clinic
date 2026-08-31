const MS_PER_DAY = 86_400_000;
const TRUTHY_FLAGS = new Set(["true", "1", "yes"]);
const UTC_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type UtcDayRange = {
  start: Date;
  end: Date;
};

function lastQueryValue(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[raw.length - 1] : undefined;
  }
  return raw;
}

/**
 * UTC calendar day as a half-open range [today 00:00:00.000Z, tomorrow 00:00:00.000Z).
 * Uses UTC midnight only — never the server's local timezone.
 */
export function getTodayUtcRange(now: Date = new Date()): UtcDayRange {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
}

/** YYYYMMDD in UTC, used for stored token prefixes. */
export function utcDatePrefix(now: Date = new Date()): string {
  const { start } = getTodayUtcRange(now);
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, "0");
  const day = String(start.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Parse `date=YYYY-MM-DD` as a UTC day range.
 * Invalid values return null (Django silently ignores them).
 */
export function parseUtcDateParam(raw: unknown): UtcDayRange | null {
  const value = lastQueryValue(raw);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = UTC_DATE_RE.exec(trimmed);
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return null;
  }
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

/**
 * Doctor `today` query flag: true / 1 / yes (case-insensitive).
 */
export function isTruthyQueryFlag(raw: unknown): boolean {
  const value = lastQueryValue(raw);
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value !== "string") {
    return false;
  }
  return TRUTHY_FLAGS.has(value.trim().toLowerCase());
}

export function createdAtUtcRangeFilter(range: UtcDayRange): {
  created_at: { $gte: Date; $lt: Date };
} {
  return { created_at: { $gte: range.start, $lt: range.end } };
}

export function fieldUtcRangeFilter(
  field: string,
  range: UtcDayRange,
): Record<string, { $gte: Date; $lt: Date }> {
  return { [field]: { $gte: range.start, $lt: range.end } };
}
