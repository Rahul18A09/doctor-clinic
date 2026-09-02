import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstErrorMessage,
  hasFieldErrors,
  mergeFieldErrors,
  PermissionMessage,
} from "../../src/http/errors";

describe("firstErrorMessage", () => {
  it("returns the first list error string", () => {
    const message = firstErrorMessage(
      {
        email: ["Enter a valid email address."],
        password: ["This field is required."],
      },
      "Validation failed.",
    );
    assert.equal(message, "Enter a valid email address.");
  });

  it("skips non-list values and uses the fallback when empty", () => {
    assert.equal(firstErrorMessage({}, "Validation failed."), "Validation failed.");
    assert.equal(
      firstErrorMessage({ detail: "ignored" } as never, "Fallback."),
      "Fallback.",
    );
  });
});

describe("field error helpers", () => {
  it("detects and merges field errors", () => {
    assert.equal(hasFieldErrors({}), false);
    const merged = mergeFieldErrors(
      { email: ["This field is required."] },
      { email: ["Enter a valid email address."], password: ["This field is required."] },
    );
    assert.deepEqual(merged, {
      email: ["This field is required.", "Enter a valid email address."],
      password: ["This field is required."],
    });
    assert.equal(hasFieldErrors(merged), true);
  });
});

describe("PermissionMessage", () => {
  it("preserves Django permission class messages", () => {
    assert.equal(PermissionMessage.admin, "Admin access required.");
    assert.equal(PermissionMessage.receptionist, "Receptionist access required.");
    assert.equal(PermissionMessage.authenticationRequired, "Authentication required.");
    assert.equal(PermissionMessage.viewPatients, "You do not have permission to view patients.");
    assert.equal(
      PermissionMessage.createPatients,
      "You do not have permission to register patients.",
    );
    assert.equal(
      PermissionMessage.updatePatients,
      "You do not have permission to update patients.",
    );
    assert.equal(PermissionMessage.deletePatients, "Only administrators can delete patients.");
    assert.equal(
      PermissionMessage.viewBeds,
      "You do not have permission to view rooms and beds.",
    );
    assert.equal(
      PermissionMessage.assignBeds,
      "You do not have permission to assign or release beds.",
    );
    assert.equal(
      PermissionMessage.manageBeds,
      "Only administrators can manage rooms and beds.",
    );
  });
});
