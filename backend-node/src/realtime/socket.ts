import type { Server as HttpServer } from "node:http";

import { Server, type Socket } from "socket.io";

import { findUserForAuth } from "../auth/findUserForAuth";
import { verifyAccessToken } from "../auth/jwt";
import type { AuthenticatedUser } from "../auth/types";
import { env } from "../config/env";
import type { SerializedNotification } from "../notifications/serializeNotification";

export const NOTIFICATION_CREATED_EVENT = "notification:created";
export const NOTIFICATION_REMOVED_EVENT = "notification:removed";

let io: Server | null = null;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function roomSize(userId: string): number {
  if (!io) return 0;
  return io.sockets.adapter.rooms.get(userRoom(userId))?.size ?? 0;
}

function readHandshakeToken(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : undefined;
  }
  return undefined;
}

async function authenticateSocket(socket: Socket): Promise<AuthenticatedUser> {
  const token = readHandshakeToken(socket);
  if (!token) {
    throw new Error("Authentication credentials were not provided.");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new Error("Token is invalid or expired.");
  }

  const user = await findUserForAuth(payload.user_id);
  if (!user || user.is_deleted) {
    throw new Error("User not found");
  }
  if (!user.is_active) {
    throw new Error("User is inactive");
  }
  return user;
}

export function attachRealtime(httpServer: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.corsAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    void authenticateSocket(socket)
      .then(async (user) => {
        socket.data.user = user;
        await socket.join(userRoom(user.id));
        next();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Token is invalid or expired.";
        console.warn(`[Socket] auth failed: ${message}`);
        next(new Error(message));
      });
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthenticatedUser | undefined;
    if (!user) {
      console.warn("[Socket] connection rejected: missing user");
      socket.disconnect(true);
      return;
    }

    console.log(
      `[Socket] connected user=${user.id} sid=${socket.id} room=${userRoom(user.id)}`,
    );

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] disconnected user=${user.id} sid=${socket.id} reason=${reason}`);
    });
  });

  return io;
}

export function getRealtime(): Server | null {
  return io;
}

export function emitNotificationCreated(userId: string, notification: SerializedNotification): void {
  if (!io) {
    console.warn(
      `[Socket] emit ${NOTIFICATION_CREATED_EVENT} skipped (realtime not attached) user=${userId} id=${notification.id}`,
    );
    return;
  }
  const size = roomSize(userId);
  console.log(
    `[Socket] emit ${NOTIFICATION_CREATED_EVENT} → ${userRoom(userId)} id=${notification.id} listeners=${size}`,
  );
  io.to(userRoom(userId)).emit(NOTIFICATION_CREATED_EVENT, { notification });
}

export function emitNotificationRemoved(userId: string, id: string): void {
  if (!io) {
    console.warn(
      `[Socket] emit ${NOTIFICATION_REMOVED_EVENT} skipped (realtime not attached) user=${userId} id=${id}`,
    );
    return;
  }
  const size = roomSize(userId);
  console.log(
    `[Socket] emit ${NOTIFICATION_REMOVED_EVENT} → ${userRoom(userId)} id=${id} listeners=${size}`,
  );
  io.to(userRoom(userId)).emit(NOTIFICATION_REMOVED_EVENT, { id });
}

export async function closeRealtime(): Promise<void> {
  if (!io) {
    return;
  }
  const current = io;
  io = null;
  await current.close();
}
