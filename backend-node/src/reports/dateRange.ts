import { PATIENT_STATUSES, type PatientStatus } from "../constants";
import type { FieldErrors } from "../http/errors";
import { parseUtcDateParam } from "../http/utc";

export const MS_PER_DAY = 86_400_000;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const CSV_MAX_ROWS = 5_000;

const TABLE_SECTIONS = new Set(["visits", "consultations"]);

export type ReportsRange = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  dayCount: number;
};

export type ParsedReportsQuery = {
  current: ReportsRange;
  previous: ReportsRange;
  table: "visits" | "consultations";
  status: PatientStatus | "";
};

export function formatUtcYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function lastQueryValue(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[raw.length - 1] : undefined;
  }
  return raw;
}

function queryString(raw: unknown): string {
  const value = lastQueryValue(raw);
  return typeof value === "string" ? value.trim() : "";
}

function rangeFromBounds(start: Date, endExclusive: Date): ReportsRange {
  const dayCount = Math.round((endExclusive.getTime() - start.getTime()) / MS_PER_DAY);
  return {
    start,
    end: endExclusive,
    startDate: formatUtcYmd(start),
    endDate: formatUtcYmd(new Date(endExclusive.getTime() - MS_PER_DAY)),
    dayCount,
  };
}

function defaultLastDays(now: Date, days: number): ReportsRange {
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(todayStart.getTime() + MS_PER_DAY);
  const start = new Date(todayStart.getTime() - (days - 1) * MS_PER_DAY);
  return rangeFromBounds(start, end);
}

function previousRange(current: ReportsRange): ReportsRange {
  const start = new Date(current.start.getTime() - current.dayCount * MS_PER_DAY);
  return rangeFromBounds(start, current.start);
}

export function eachUtcDate(start: Date, endExclusive: Date): string[] {
  const dates: string[] = [];
  for (let time = start.getTime(); time < endExclusive.getTime(); time += MS_PER_DAY) {
    dates.push(formatUtcYmd(new Date(time)));
  }
  return dates;
}

export function bucketDailyComparison(
  rows: Array<{
    date: string;
    previous_date: string;
    this_period: number;
    previous_period: number;
  }>,
  maxBuckets = 8,
): typeof rows {
  if (rows.length <= maxBuckets) {
    return rows;
  }
  const size = Math.ceil(rows.length / maxBuckets);
  const buckets: typeof rows = [];
  for (let index = 0; index < rows.length; index += size) {
    const slice = rows.slice(index, index + size);
    const first = slice[0];
    if (!first) continue;
    buckets.push({
      date: first.date,
      previous_date: first.previous_date,
      this_period: slice.reduce((sum, row) => sum + row.this_period, 0),
      previous_period: slice.reduce((sum, row) => sum + row.previous_period, 0),
    });
  }
  return buckets;
}

export function parseReportsQuery(
  query: Record<string, unknown> = {},
  now: Date = new Date(),
): { ok: true; value: ParsedReportsQuery } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const startRaw = queryString(query.start_date);
  const endRaw = queryString(query.end_date);
  const hasStart = startRaw.length > 0;
  const hasEnd = endRaw.length > 0;

  let current: ReportsRange;
  if (!hasStart && !hasEnd) {
    current = defaultLastDays(now, DEFAULT_RANGE_DAYS);
  } else if (!hasStart || !hasEnd) {
    if (!hasStart) errors.start_date = ["Start date and end date are both required."];
    if (!hasEnd) errors.end_date = ["Start date and end date are both required."];
    return { ok: false, errors };
  } else {
    const from = parseUtcDateParam(startRaw);
    const to = parseUtcDateParam(endRaw);
    if (!from) {
      errors.start_date = ["Enter a valid start date (YYYY-MM-DD)."];
    }
    if (!to) {
      errors.end_date = ["Enter a valid end date (YYYY-MM-DD)."];
    }
    if (!from || !to) {
      return { ok: false, errors };
    }
    if (from.start.getTime() > to.start.getTime()) {
      errors.start_date = ["Start date must be on or before the end date."];
      return { ok: false, errors };
    }
    current = rangeFromBounds(from.start, to.end);
    if (current.dayCount > MAX_RANGE_DAYS) {
      errors.end_date = [`Date range cannot exceed ${MAX_RANGE_DAYS} days.`];
      return { ok: false, errors };
    }
  }

  const tableRaw = queryString(query.table).toLowerCase();
  const table = TABLE_SECTIONS.has(tableRaw)
    ? (tableRaw as "visits" | "consultations")
    : "visits";

  const statusRaw = queryString(query.status).toUpperCase();
  let status: PatientStatus | "" = "";
  if (statusRaw) {
    if ((PATIENT_STATUSES as readonly string[]).includes(statusRaw)) {
      status = statusRaw as PatientStatus;
    } else {
      errors.status = ["Invalid visit status."];
      return { ok: false, errors };
    }
  }

  return {
    ok: true,
    value: {
      current,
      previous: previousRange(current),
      table,
      status,
    },
  };
}
