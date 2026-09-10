import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toIsoUtc } from "../../src/http/iso";

describe("toIsoUtc", () => {
  it("returns ISO 8601 UTC with a Z suffix", () => {
    const value = new Date("2026-09-10T04:46:00.000Z");
    assert.equal(toIsoUtc(value), "2026-09-10T04:46:00.000Z");
  });

  it("returns null for missing or invalid values", () => {
    assert.equal(toIsoUtc(null), null);
    assert.equal(toIsoUtc(undefined), null);
    assert.equal(toIsoUtc(new Date("not-a-date")), null);
  });
});
