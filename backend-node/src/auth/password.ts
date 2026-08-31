import { pbkdf2 as pbkdf2Callback, randomInt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(pbkdf2Callback);

const DJANGO_PBKDF2_SHA256 = "pbkdf2_sha256";
const UNUSABLE_PASSWORD_PREFIX = "!";
const DJANGO_PBKDF2_SHA256_ITERATIONS = 1_200_000;
const DJANGO_SALT_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Django's PBKDF2PasswordHasher calls hashlib.pbkdf2_hmac without dklen,
 * so the derived key length is SHA-256's digest size (32 bytes), then Base64.
 */
const DJANGO_PBKDF2_SHA256_KEYLEN = 32;

type ParsedDjangoHash = {
  algorithm: string;
  iterations: number;
  salt: string;
  digest: string;
};

function randomDjangoSalt(length: number): string {
  let salt = "";
  for (let i = 0; i < length; i += 1) {
    const index = randomInt(DJANGO_SALT_CHARS.length);
    salt += DJANGO_SALT_CHARS[index];
  }
  return salt;
}

function parseDjangoHash(encoded: string): ParsedDjangoHash | undefined {
  if (!encoded || encoded.startsWith(UNUSABLE_PASSWORD_PREFIX)) {
    return undefined;
  }

  const parts = encoded.split("$");
  if (parts.length !== 4) {
    return undefined;
  }

  const [algorithm, iterationsRaw, salt, digest] = parts;
  if (algorithm !== DJANGO_PBKDF2_SHA256) {
    return undefined;
  }
  if (!iterationsRaw || !salt || !digest) {
    return undefined;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1) {
    return undefined;
  }

  return { algorithm, iterations, salt, digest };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

async function encodePbkdf2Sha256(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const derived = await pbkdf2(
    password,
    salt,
    iterations,
    DJANGO_PBKDF2_SHA256_KEYLEN,
    "sha256",
  );
  const digest = derived.toString("base64");
  return `${DJANGO_PBKDF2_SHA256}$${iterations}$${salt}$${digest}`;
}

export function isDjangoPasswordHash(encoded: string): boolean {
  return parseDjangoHash(encoded) !== undefined;
}

/** Create a Django-compatible `pbkdf2_sha256` hash (1,200,000 iterations). */
export async function hashDjangoPassword(password: string): Promise<string> {
  const salt = randomDjangoSalt(12);
  return encodePbkdf2Sha256(password, salt, DJANGO_PBKDF2_SHA256_ITERATIONS);
}

/**
 * Verify a plaintext password against a Django `pbkdf2_sha256$…` hash.
 * Uses the iteration count stored in the hash. Does not rewrite hashes.
 */
export async function verifyDjangoPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parsed = parseDjangoHash(encoded);
  if (!parsed) {
    return false;
  }

  const recomputed = await encodePbkdf2Sha256(
    password,
    parsed.salt,
    parsed.iterations,
  );
  return safeEqual(encoded, recomputed);
}
