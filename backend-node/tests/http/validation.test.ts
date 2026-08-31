import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ValidationMessage,
  collectFieldErrors,
  escapeRegex,
  icontainsRegex,
  isMongoObjectId,
  isValidEmail,
  readBloodGroup,
  readOptionalChoice,
  readOptionalString,
  readQueryString,
  readRequiredChoice,
  readRequiredEmail,
  readOptionalNullableFloat,
  readRequiredInt,
  readRequiredString,
  readBody,
} from "../../src/http/validation";

describe("string and email helpers", () => {
  it("validates emails used by login/receptionist create", () => {
    assert.equal(isValidEmail("admin@gmail.com"), true);
    assert.equal(isValidEmail("not-an-email"), false);
  });

  it("accepts 24-char hex ObjectIds only", () => {
    assert.equal(isMongoObjectId("6a72b26dedcd1f8304e2f138"), true);
    assert.equal(isMongoObjectId("short"), false);
    assert.equal(isMongoObjectId("zzzzzzzzzzzzzzzzzzzzzzzz"), false);
  });

  it("escapes icontains search for Mongo regex", () => {
    assert.equal(escapeRegex("a.b+c"), "a\\.b\\+c");
    assert.deepEqual(icontainsRegex("P0001"), { $regex: "P0001", $options: "i" });
  });

  it("reads a trimmed query string", () => {
    assert.equal(readQueryString("  waiting "), "waiting");
    assert.equal(readQueryString(["a", " b "]), "b");
    assert.equal(readQueryString(undefined), "");
  });

  it("reads a JSON object body", () => {
    assert.deepEqual(readBody({ email: "a@b.com" }), { email: "a@b.com" });
    assert.deepEqual(readBody(null), {});
    assert.deepEqual(readBody(["nope"]), {});
  });
});

describe("required/optional string fields", () => {
  it("returns DRF required and blank messages", () => {
    assert.deepEqual(readRequiredString({}, "full_name"), {
      errors: [ValidationMessage.required],
    });
    assert.deepEqual(readRequiredString({ full_name: "" }, "full_name"), {
      errors: [ValidationMessage.blank],
    });
    assert.deepEqual(readRequiredString({ full_name: "  Ada  " }, "full_name"), {
      value: "Ada",
      errors: [],
    });
  });

  it("enforces max_length 255 / 20", () => {
    const tooLong = "x".repeat(256);
    assert.deepEqual(readRequiredString({ full_name: tooLong }, "full_name", { maxLength: 255 }), {
      errors: [ValidationMessage.maxLength(255)],
    });
    assert.deepEqual(readRequiredString({ mobile: "1".repeat(21) }, "mobile", { maxLength: 20 }), {
      errors: [ValidationMessage.maxLength(20)],
    });
  });

  it("allows omitted optional strings and optional blanks when requested", () => {
    assert.deepEqual(readOptionalString({}, "address"), { errors: [] });
    assert.deepEqual(
      readOptionalString({ address: "  " }, "address", { allowBlank: true }),
      { value: "", errors: [] },
    );
  });

  it("lowercases and validates required emails", () => {
    assert.deepEqual(readRequiredEmail({ email: "  Admin@Gmail.com " }), {
      value: "admin@gmail.com",
      errors: [],
    });
    assert.deepEqual(readRequiredEmail({ email: "nope" }), {
      errors: [ValidationMessage.invalidEmail],
    });
  });
});

describe("integer and choice fields", () => {
  it("validates age 0–150 with DRF messages", () => {
    assert.deepEqual(readRequiredInt({ age: 30 }, "age", { min: 0, max: 150 }), {
      value: 30,
      errors: [],
    });
    assert.deepEqual(readRequiredInt({ age: "0" }, "age", { min: 0, max: 150 }), {
      value: 0,
      errors: [],
    });
    assert.deepEqual(readRequiredInt({ age: -1 }, "age", { min: 0, max: 150 }), {
      errors: [ValidationMessage.minValue(0)],
    });
    assert.deepEqual(readRequiredInt({ age: 151 }, "age", { min: 0, max: 150 }), {
      errors: [ValidationMessage.maxValue(150)],
    });
    assert.deepEqual(readRequiredInt({ age: "1.5" }, "age", { min: 0, max: 150 }), {
      errors: [ValidationMessage.invalidInteger],
    });
    assert.deepEqual(readRequiredInt({}, "age", { min: 0, max: 150 }), {
      errors: [ValidationMessage.required],
    });
  });

  it("parses DRF optional nullable floats", () => {
    assert.deepEqual(readOptionalNullableFloat({}, "temperature"), {
      assigned: false,
      errors: [],
    });
    assert.deepEqual(readOptionalNullableFloat({ temperature: null }, "temperature"), {
      assigned: true,
      value: null,
      errors: [],
    });
    assert.deepEqual(readOptionalNullableFloat({ temperature: "98.6" }, "temperature"), {
      assigned: true,
      value: 98.6,
      errors: [],
    });
    assert.deepEqual(readOptionalNullableFloat({ temperature: "hot" }, "temperature"), {
      assigned: true,
      errors: [ValidationMessage.invalidNumber],
    });
  });

  it("validates gender and blood_group choices", () => {
    assert.deepEqual(readRequiredChoice({ gender: "FEMALE" }, "gender", ["MALE", "FEMALE", "OTHER"]), {
      value: "FEMALE",
      errors: [],
    });
    assert.deepEqual(readRequiredChoice({ gender: "X" }, "gender", ["MALE", "FEMALE", "OTHER"]), {
      errors: [ValidationMessage.invalidChoice("X")],
    });
    assert.deepEqual(readBloodGroup({ blood_group: "" }, false), {
      value: "",
      errors: [],
    });
    assert.deepEqual(readBloodGroup({ blood_group: "A+" }, false), {
      value: "A+",
      errors: [],
    });
    assert.deepEqual(readOptionalChoice({ blood_group: "Z+" }, "blood_group", ["A+", "A-"], {
      allowBlank: true,
    }), {
      errors: [ValidationMessage.invalidChoice("Z+")],
    });
  });
});

describe("collectFieldErrors", () => {
  it("drops fields without errors", () => {
    const errors = collectFieldErrors({
      full_name: { errors: [] },
      mobile: { errors: [ValidationMessage.required] },
    });
    assert.deepEqual(errors, { mobile: [ValidationMessage.required] });
  });
});
