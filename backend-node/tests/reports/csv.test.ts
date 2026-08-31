import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvEscape, toCsv } from "../../src/reports/csv";

describe("reports CSV helpers", () => {
  it("quotes cells that contain commas, quotes, or newlines", () => {
    assert.equal(csvEscape("ok"), "ok");
    assert.equal(csvEscape("a,b"), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape("line\nbreak"), '"line\nbreak"');
  });

  it("builds a BOM-prefixed CRLF CSV", () => {
    const csv = toCsv(["Patient", "Token"], [["Patel, A", "0001"]]);
    assert.equal(csv.startsWith("\uFEFF"), true);
    assert.match(csv, /Patient,Token/);
    assert.match(csv, /"Patel, A",0001/);
  });
});
