import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";

import type { UserRole } from "../constants";

const ALGORITHM = "HS256" as const;

export type TokenUserClaims = {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

export type AccessTokenPayload = TokenUserClaims & {
  token_type: "access";
  jti: string;
  iat: number;
  exp: number;
};

export type RefreshTokenPayload = TokenUserClaims & {
  token_type: "refresh";
  jti: string;
  iat: number;
  exp: number;
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"]?.trim() || process.env["SECRET_KEY"]?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET or SECRET_KEY is not set.");
  }
  return secret;
}

function getJwtLifetimes(): { accessSeconds: number; refreshSeconds: number } {
  const accessMinutes = readPositiveInt("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60);
  const refreshDays = readPositiveInt("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7);
  return {
    accessSeconds: accessMinutes * 60,
    refreshSeconds: refreshDays * 24 * 60 * 60,
  };
}

function signToken(
  claims: TokenUserClaims,
  tokenType: "access" | "refresh",
  expiresInSeconds: number,
): string {
  return jwt.sign(
    {
      token_type: tokenType,
      jti: randomUUID(),
      user_id: claims.user_id,
      email: claims.email,
      full_name: claims.full_name,
      role: claims.role,
    },
    getJwtSecret(),
    {
      algorithm: ALGORITHM,
      expiresIn: expiresInSeconds,
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringClaim(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Token is missing claim '${key}'.`);
  }
  return value;
}

function readNumericClaim(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Token is missing claim '${key}'.`);
  }
  return value;
}

function decodeAndVerify(token: string): Record<string, unknown> {
  const payload = jwt.verify(token, getJwtSecret(), {
    algorithms: [ALGORITHM],
  });
  if (!isRecord(payload)) {
    throw new Error("Token payload is invalid.");
  }
  return payload;
}

function toUserClaims(payload: Record<string, unknown>): TokenUserClaims {
  const role = readStringClaim(payload, "role");
  if (role !== "ADMIN" && role !== "RECEPTIONIST") {
    throw new Error("Token role is invalid.");
  }
  return {
    user_id: readStringClaim(payload, "user_id"),
    email: readStringClaim(payload, "email"),
    full_name: readStringClaim(payload, "full_name"),
    role,
  };
}

export function generateAccessToken(user: TokenUserClaims): string {
  return signToken(user, "access", getJwtLifetimes().accessSeconds);
}

export function generateRefreshToken(user: TokenUserClaims): string {
  return signToken(user, "refresh", getJwtLifetimes().refreshSeconds);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = decodeAndVerify(token);
  const tokenType = readStringClaim(payload, "token_type");
  if (tokenType !== "access") {
    throw new Error("Invalid access token.");
  }
  return {
    ...toUserClaims(payload),
    token_type: "access",
    jti: readStringClaim(payload, "jti"),
    iat: readNumericClaim(payload, "iat"),
    exp: readNumericClaim(payload, "exp"),
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = decodeAndVerify(token);
  const tokenType = readStringClaim(payload, "token_type");
  if (tokenType !== "refresh") {
    throw new Error("Invalid refresh token.");
  }
  return {
    ...toUserClaims(payload),
    token_type: "refresh",
    jti: readStringClaim(payload, "jti"),
    iat: readNumericClaim(payload, "iat"),
    exp: readNumericClaim(payload, "exp"),
  };
}
