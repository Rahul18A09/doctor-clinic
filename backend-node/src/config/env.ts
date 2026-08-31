import dotenv from "dotenv";
import os from "node:os";

dotenv.config();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill in the values.`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  return parsed;
}

function splitCsv(name: string, fallback: string): string[] {
  return optional(name, fallback)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function lanIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = entry.family;
      const isV4 = family === "IPv4";
      if (isV4 && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

function lanDevOrigins(): string[] {
  const ports = [5173, 5174, 4173];
  const origins: string[] = [];
  for (const address of lanIpv4Addresses()) {
    for (const port of ports) {
      origins.push(`http://${address}:${port}`);
      origins.push(`https://${address}:${port}`);
    }
  }
  return origins;
}

const nodeEnv = optional("NODE_ENV", "development");

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: optionalInt("PORT", 8001),
  secretKey: optional("SECRET_KEY", "django-insecure-change-me-in-production"),
  mongodbUri: required("MONGODB_URI"),
  databaseName: optional("DATABASE_NAME", "doctor_db"),
  mongodbServerSelectionTimeoutMs: optionalInt(
    "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
    10_000,
  ),
  jwtAccessTokenLifetimeMinutes: optionalInt("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60),
  jwtRefreshTokenLifetimeDays: optionalInt("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7),
  corsAllowedOrigins: unique([
    ...splitCsv(
      "CORS_ALLOWED_ORIGINS",
      "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://localhost:5173,https://127.0.0.1:5173,https://localhost:4173,https://127.0.0.1:4173",
    ),
    ...lanDevOrigins(),
  ]),
  allowedHosts: unique([
    ...splitCsv("ALLOWED_HOSTS", "localhost,127.0.0.1"),
    ...lanIpv4Addresses(),
  ]),
} as const;

export type AppEnv = typeof env;
