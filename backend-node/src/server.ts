import type { Server } from "node:http";

import app from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";

let server: Server | undefined;
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`Received ${signal}. Shutting down gracefully...`);

  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    await disconnectDatabase();
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown shutdown error";
    console.error(`Graceful shutdown failed: ${message}`);
    process.exit(1);
  }
}

async function start(): Promise<void> {
  await connectDatabase();

  server = app.listen(env.port, () => {
    console.log(`backend-node listening on port ${env.port}`);
    console.log(`API docs: http://127.0.0.1:${env.port}/api/docs/`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(`HTTP server error: ${error.message}`);
    void disconnectDatabase().finally(() => {
      process.exit(1);
    });
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Failed to start server: ${message}`);
  process.exit(1);
});
