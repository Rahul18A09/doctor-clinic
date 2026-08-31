import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bucketDailyComparison,
  eachUtcDate,
  formatUtcYmd,
  parseReportsQuery,
  percentChange,
} from "../../src/reports/dateRange";

describe("reports date range", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("defaults to the last 30 UTC days when dates are omitted", () => {
    const parsed = parseReportsQuery({}, now);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.current.startDate, "2026-07-22");
    assert.equal(parsed.value.current.endDate, "2026-08-20");
    assert.equal(parsed.value.current.dayCount, 30);
    assert.equal(parsed.value.current.start.toISOString(), "2026-07-22T00:00:00.000Z");
    assert.equal(parsed.value.current.end.toISOString(), "2026-08-21T00:00:00.000Z");
    assert.equal(parsed.value.previous.startDate, "2026-06-22");
    assert.equal(parsed.value.previous.endDate, "2026-07-21");
    assert.equal(parsed.value.table, "visits");
  });

  it("parses an explicit inclusive UTC range and previous period", () => {
    const parsed = parseReportsQuery(
      { start_date: "2026-08-01", end_date: "2026-08-10" },
      now,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.current.dayCount, 10);
    assert.equal(parsed.value.current.start.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(parsed.value.current.end.toISOString(), "2026-08-11T00:00:00.000Z");
    assert.equal(parsed.value.previous.startDate, "2026-07-22");
    assert.equal(parsed.value.previous.endDate, "2026-07-31");
  });

  it("rejects a missing counterpart date, inverted range, and invalid values", () => {
    const missingEnd = parseReportsQuery({ start_date: "2026-08-01" }, now);
    assert.equal(missingEnd.ok, false);

    const inverted = parseReportsQuery(
      { start_date: "2026-08-10", end_date: "2026-08-01" },
      now,
    );
    assert.equal(inverted.ok, false);

    const invalid = parseReportsQuery(
      { start_date: "2026-13-01", end_date: "not-a-date" },
      now,
    );
    assert.equal(invalid.ok, false);

    const tooLong = parseReportsQuery(
      { start_date: "2025-01-01", end_date: "2026-08-20" },
      now,
    );
    assert.equal(tooLong.ok, false);
  });

  it("accepts table=consultations and a known status", () => {
    const parsed = parseReportsQuery(
      {
        start_date: "2026-08-01",
        end_date: "2026-08-01",
        table: "consultations",
        status: "completed",
      },
      now,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.table, "consultations");
    assert.equal(parsed.value.status, "COMPLETED");
  });
});

describe("reports helpers", () => {
  it("computes percent change to one decimal", () => {
    assert.equal(percentChange(110, 100), 10);
    assert.equal(percentChange(0, 0), 0);
    assert.equal(percentChange(5, 0), 100);
    assert.equal(percentChange(85, 100), -15);
  });

  it("lists each UTC day in a half-open range", () => {
    const dates = eachUtcDate(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-04T00:00:00.000Z"),
    );
    assert.deepEqual(dates, ["2026-08-01", "2026-08-02", "2026-08-03"]);
    assert.equal(formatUtcYmd(new Date("2026-08-20T23:59:59.000Z")), "2026-08-20");
  });

  it("buckets daily comparison series", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      previous_date: `2026-07-${String(index + 22).padStart(2, "0")}`,
      this_period: 1,
      previous_period: 2,
    }));
    const buckets = bucketDailyComparison(rows, 5);
    assert.equal(buckets.length, 5);
    assert.equal(buckets[0]?.this_period, 2);
    assert.equal(buckets[0]?.previous_period, 4);
  });
});
