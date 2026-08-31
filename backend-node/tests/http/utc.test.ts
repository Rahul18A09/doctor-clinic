import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createdAtUtcRangeFilter,
  fieldUtcRangeFilter,
  getTodayUtcRange,
  isTruthyQueryFlag,
  parseUtcDateParam,
  utcDatePrefix,
} from "../../src/http/utc";

describe("getTodayUtcRange", () => {
  it("uses UTC midnight, not local server time", () => {
    // 2026-08-20 01:00 IST == 2026-08-19 19:30 UTC — previous UTC day.
    const now = new Date("2026-08-19T19:30:00.000Z");
    const { start, end } = getTodayUtcRange(now);
    assert.equal(start.toISOString(), "2026-08-19T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-08-20T00:00:00.000Z");
    assert.equal(start.getUTCHours(), 0);
    assert.equal(start.getUTCMinutes(), 0);
    assert.equal(start.getUTCSeconds(), 0);
    assert.equal(start.getUTCMilliseconds(), 0);
  });

  it("starts a new day at UTC midnight, not at IST midnight", () => {
    const justBefore = getTodayUtcRange(new Date("2026-08-19T23:59:59.999Z"));
    assert.equal(justBefore.start.toISOString(), "2026-08-19T00:00:00.000Z");

    const exactlyMidnight = getTodayUtcRange(new Date("2026-08-20T00:00:00.000Z"));
    assert.equal(exactlyMidnight.start.toISOString(), "2026-08-20T00:00:00.000Z");
    assert.equal(exactlyMidnight.end.toISOString(), "2026-08-21T00:00:00.000Z");
  });

  it("is a half-open [start, end) window of exactly one UTC day", () => {
    const { start, end } = getTodayUtcRange(new Date("2026-08-19T13:00:00.000Z"));
    assert.equal(end.getTime() - start.getTime(), 86_400_000);
  });

  it("does not use Date local getters for the calendar day", () => {
    const now = new Date("2026-08-19T19:30:00.000Z");
    const { start } = getTodayUtcRange(now);
    assert.equal(start.toISOString(), "2026-08-19T00:00:00.000Z");
    const localMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    if (now.getTimezoneOffset() !== 0) {
      assert.notEqual(start.getTime(), localMidnight.getTime());
    }
  });
});

describe("utcDatePrefix", () => {
  it("returns YYYYMMDD for the UTC calendar day", () => {
    assert.equal(utcDatePrefix(new Date("2026-08-19T19:30:00.000Z")), "20260819");
    assert.equal(utcDatePrefix(new Date("2026-08-20T00:00:00.000Z")), "20260820");
  });
});

describe("parseUtcDateParam", () => {
  it("parses YYYY-MM-DD as a UTC day range", () => {
    const range = parseUtcDateParam("2026-08-19");
    assert.ok(range);
    assert.equal(range.start.toISOString(), "2026-08-19T00:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-08-20T00:00:00.000Z");
  });

  it("returns null for invalid dates and does not overflow months", () => {
    assert.equal(parseUtcDateParam(""), null);
    assert.equal(parseUtcDateParam("not-a-date"), null);
    assert.equal(parseUtcDateParam("2026-13-01"), null);
    assert.equal(parseUtcDateParam("2026-02-29"), null);
    assert.equal(parseUtcDateParam("2026-8-19"), null);
  });

  it("accepts a leap day", () => {
    const range = parseUtcDateParam("2024-02-29");
    assert.ok(range);
    assert.equal(range.start.toISOString(), "2024-02-29T00:00:00.000Z");
  });
});

describe("isTruthyQueryFlag", () => {
  it("accepts true, 1, and yes case-insensitively", () => {
    assert.equal(isTruthyQueryFlag("true"), true);
    assert.equal(isTruthyQueryFlag("TRUE"), true);
    assert.equal(isTruthyQueryFlag("1"), true);
    assert.equal(isTruthyQueryFlag("yes"), true);
    assert.equal(isTruthyQueryFlag("Yes"), true);
  });

  it("rejects other values", () => {
    assert.equal(isTruthyQueryFlag("false"), false);
    assert.equal(isTruthyQueryFlag("on"), false);
    assert.equal(isTruthyQueryFlag("y"), false);
    assert.equal(isTruthyQueryFlag(""), false);
    assert.equal(isTruthyQueryFlag(undefined), false);
  });
});

describe("mongo UTC range filters", () => {
  it("builds created_at $gte/$lt filters", () => {
    const range = getTodayUtcRange(new Date("2026-08-19T12:00:00.000Z"));
    assert.deepEqual(createdAtUtcRangeFilter(range), {
      created_at: { $gte: range.start, $lt: range.end },
    });
    assert.deepEqual(fieldUtcRangeFilter("consultation_completed_at", range), {
      consultation_completed_at: { $gte: range.start, $lt: range.end },
    });
  });
});
