import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDjangoPasswordHash, verifyDjangoPassword } from "../../src/auth/password";

/**
 * Produced by Django 6.0.8 `PBKDF2PasswordHasher.encode`
 * (`django.contrib.auth.hashers`) for password `test-password-123`.
 * Format: pbkdf2_sha256$<iterations>$<salt>$<base64>
 */
const DJANGO_HASH_1_200_000 =
  "pbkdf2_sha256$1200000$abCDef12ghij$vWACbQyui0cYseojcMzTrUCB4LFmIJLksk9o40K4bQs=";

const DJANGO_HASH_260_000 =
  "pbkdf2_sha256$260000$shortSalt12x$w4vMM+GNTBCorLiM8iK6Bcvtca0tyeg9E1aVSPWhkRM=";

const PLAINTEXT = "test-password-123";

describe("verifyDjangoPassword", () => {
  it("accepts a real Django 1,200,000-iteration pbkdf2_sha256 hash", async () => {
    assert.equal(await verifyDjangoPassword(PLAINTEXT, DJANGO_HASH_1_200_000), true);
  });

  it("rejects the wrong password for the same Django hash", async () => {
    assert.equal(
      await verifyDjangoPassword("wrong-password", DJANGO_HASH_1_200_000),
      false,
    );
  });

  it("uses the iteration count encoded in the hash (260000)", async () => {
    assert.equal(await verifyDjangoPassword(PLAINTEXT, DJANGO_HASH_260_000), true);
  });

  it("rejects a 260000-iteration hash when the password is wrong", async () => {
    assert.equal(await verifyDjangoPassword("nope", DJANGO_HASH_260_000), false);
  });

  it("returns false for malformed hashes", async () => {
    assert.equal(await verifyDjangoPassword(PLAINTEXT, ""), false);
    assert.equal(await verifyDjangoPassword(PLAINTEXT, "not-a-hash"), false);
    assert.equal(await verifyDjangoPassword(PLAINTEXT, "pbkdf2_sha256$x$y$z"), false);
  });

  it("returns false for Django unusable-password markers", async () => {
    assert.equal(await verifyDjangoPassword(PLAINTEXT, "!unusable"), false);
  });

  it("does not treat bcrypt hashes as Django hashes", async () => {
    const bcrypt =
      "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    assert.equal(isDjangoPasswordHash(bcrypt), false);
    assert.equal(await verifyDjangoPassword(PLAINTEXT, bcrypt), false);
  });
});
