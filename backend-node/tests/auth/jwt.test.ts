import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../src/auth/jwt";

const TEST_USER = {
  user_id: "6a72b26dedcd1f8304e2f138",
  email: "admin@example.com",
  full_name: "System Administrator",
  role: "ADMIN" as const,
};

describe("jwt utility", () => {
  process.env["SECRET_KEY"] = "jwt-unit-test-secret";
  process.env["JWT_SECRET"] = "";
  process.env["JWT_ACCESS_TOKEN_LIFETIME_MINUTES"] = "60";
  process.env["JWT_REFRESH_TOKEN_LIFETIME_DAYS"] = "7";

  it("generateAccessToken signs a verifiable HS256 access token with required claims", () => {
    const token = generateAccessToken(TEST_USER);
    const payload = verifyAccessToken(token);

    assert.equal(payload.token_type, "access");
    assert.equal(payload.user_id, TEST_USER.user_id);
    assert.equal(payload.email, TEST_USER.email);
    assert.equal(payload.full_name, TEST_USER.full_name);
    assert.equal(payload.role, TEST_USER.role);
    assert.equal(typeof payload.jti, "string");
    assert.ok(payload.jti.length > 0);
    assert.equal(payload.exp - payload.iat, 60 * 60);
  });

  it("generateRefreshToken signs a verifiable HS256 refresh token with required claims", () => {
    const token = generateRefreshToken(TEST_USER);
    const payload = verifyRefreshToken(token);

    assert.equal(payload.token_type, "refresh");
    assert.equal(payload.user_id, TEST_USER.user_id);
    assert.equal(payload.email, TEST_USER.email);
    assert.equal(payload.full_name, TEST_USER.full_name);
    assert.equal(payload.role, TEST_USER.role);
    assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
  });

  it("rejects access tokens in verifyRefreshToken and refresh tokens in verifyAccessToken", () => {
    const access = generateAccessToken(TEST_USER);
    const refresh = generateRefreshToken(TEST_USER);

    assert.throws(() => verifyRefreshToken(access), /Invalid refresh token/);
    assert.throws(() => verifyAccessToken(refresh), /Invalid access token/);
  });

  it("rejects a tampered token", () => {
    const token = generateAccessToken(TEST_USER);
    const tampered = `${token.slice(0, -4)}xxxx`;
    assert.throws(() => verifyAccessToken(tampered));
  });

  it("rotates refresh tokens by issuing a new jti without blacklisting the previous one", () => {
    const first = generateRefreshToken(TEST_USER);
    const second = generateRefreshToken(TEST_USER);

    const firstPayload = verifyRefreshToken(first);
    const secondPayload = verifyRefreshToken(second);

    assert.notEqual(first, second);
    assert.notEqual(firstPayload.jti, secondPayload.jti);
    assert.equal(firstPayload.user_id, secondPayload.user_id);
  });

  it("reads the HMAC secret from the environment and rejects a token signed with another secret", () => {
    const token = generateAccessToken(TEST_USER);
    const originalSecret = process.env["SECRET_KEY"];
    process.env["SECRET_KEY"] = "a-different-secret";
    try {
      assert.throws(() => verifyAccessToken(token));
    } finally {
      if (originalSecret === undefined) {
        delete process.env["SECRET_KEY"];
      } else {
        process.env["SECRET_KEY"] = originalSecret;
      }
    }
  });
});
