import mongoose from "mongoose";

import { env } from "./env";

const ATLAS_SSL_HINT =
  "MongoDB Atlas rejected the TLS handshake. This usually means your current " +
  "public IP is not allowed in Atlas → Network Access (Add IP Address), or " +
  "the cluster is paused. Allow your IP (or 0.0.0.0/0 for local dev only), " +
  "wait ~1 minute, then restart the server.";

let shuttingDown = false;

function normalizeMongoUri(uri: string): string {
  if (!uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  const url = new URL(uri);
  if (!url.searchParams.has("retryWrites")) {
    url.searchParams.set("retryWrites", "true");
  }
  if (!url.searchParams.has("w")) {
    url.searchParams.set("w", "majority");
  }
  return url.toString();
}

function formatConnectError(error: unknown): string {
  const detail = error instanceof Error ? error.message : "Connection failed.";
  const hinted =
    detail.includes("SSL handshake failed") || detail.includes("TLSV1_ALERT_INTERNAL_ERROR")
      ? `${detail} ${ATLAS_SSL_HINT}`
      : detail;
  return `Unable to connect to MongoDB Atlas. ${hinted}`;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return false;
    }
    await db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function connectDatabase(): Promise<void> {
  shuttingDown = false;
  // Do not create indexes or collections; use the existing doctor_db data as-is.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);

  if (mongoose.connection.readyState === 1) {
    return;
  }

  mongoose.connection.on("error", (error: unknown) => {
    if (!shuttingDown) {
      const message = error instanceof Error ? error.message : "Unknown MongoDB error";
      console.error(`MongoDB connection error: ${message}`);
    }
  });

  mongoose.connection.on("disconnected", () => {
    if (!shuttingDown) {
      console.error("MongoDB disconnected.");
    }
  });

  if (env.databaseName !== "doctor_db") {
    throw new Error(
      `Refusing to connect: DATABASE_NAME must be doctor_db (got '${env.databaseName}').`,
    );
  }

  const uri = normalizeMongoUri(env.mongodbUri);

  try {
    await mongoose.connect(uri, {
      dbName: "doctor_db",
      serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
    });
  } catch (error: unknown) {
    throw new Error(formatConnectError(error));
  }

  const db = mongoose.connection.db;
  if (!db || db.databaseName !== env.databaseName) {
    await mongoose.disconnect();
    throw new Error(
      `Connected to unexpected database '${db?.databaseName ?? "unknown"}'. Expected '${env.databaseName}'.`,
    );
  }

  const reachable = await pingDatabase();
  if (!reachable) {
    await mongoose.disconnect();
    throw new Error("Unable to connect to MongoDB Atlas. Connection ping failed.");
  }

  console.log(`Connected to MongoDB database: ${db.databaseName}`);
}

export async function disconnectDatabase(): Promise<void> {
  shuttingDown = true;
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}
