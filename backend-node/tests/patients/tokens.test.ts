import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatTokenForDisplay, nextStoredToken } from "../../src/patients/tokens";

describe("formatTokenForDisplay", () => {
  it("turns stored YYYYMMDD-P0001 into P0001", () => {
    assert.equal(formatTokenForDisplay("20260819-P0001"), "P0001");
    assert.equal(formatTokenForDisplay("20260819-P0012"), "P0012");
  });

  it("returns legacy P-tokens unchanged and empty for missing values", () => {
    assert.equal(formatTokenForDisplay("P0007"), "P0007");
    assert.equal(formatTokenForDisplay(""), "");
    assert.equal(formatTokenForDisplay(undefined), "");
  });
});

describe("nextStoredToken", () => {
  const now = new Date("2026-08-19T13:00:00.000Z");

  it("starts at YYYYMMDD-P0001 when none exist today", () => {
    assert.equal(nextStoredToken([], now), "20260819-P0001");
  });

  it("increments the max sequence for the UTC day", () => {
    assert.equal(
      nextStoredToken(["20260819-P0001", "20260819-P0003"], now),
      "20260819-P0004",
    );
  });

  it("counts legacy P#### tokens toward the max", () => {
    assert.equal(nextStoredToken(["P0007"], now), "20260819-P0008");
  });

  it("resets the sequence on a new UTC day and ignores yesterday's prefix", () => {
    assert.equal(nextStoredToken(["20260818-P0099"], now), "20260819-P0001");
    const nextDay = new Date("2026-08-20T00:00:00.000Z");
    assert.equal(nextStoredToken(["20260819-P0042"], nextDay), "20260820-P0001");
  });
});
