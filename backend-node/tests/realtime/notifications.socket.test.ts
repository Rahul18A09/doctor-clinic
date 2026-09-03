import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { io as ioc, type Socket as ClientSocket } from "socket.io-client";

import { createApp } from "../../src/app";
import { generateAccessToken } from "../../src/auth/jwt";
import { hashDjangoPassword } from "../../src/auth/password";
import { connectDatabase, disconnectDatabase } from "../../src/config/database";
import { NotificationType, UserRole } from "../../src/constants";
import { Notification } from "../../src/models/notification.model";
import { User } from "../../src/models/user.model";
import { ADMIN_ROLES, notifyStaff, resolveQueueNotifications } from "../../src/notifications/notifyStaff";
import {
  NOTIFICATION_CREATED_EVENT,
  NOTIFICATION_REMOVED_EVENT,
  attachRealtime,
  closeRealtime,
} from "../../src/realtime/socket";

const PASSWORD = "Socket-Notify9x";

function accessFor(user: { _id: { toString(): string }; email: string; full_name: string; role: string }) {
  return generateAccessToken({
    user_id: String(user._id),
    email: user.email,
    full_name: user.full_name,
    role: user.role as UserRole,
  });
}

function connectClient(port: number, token: string): ClientSocket {
  return ioc(`http://127.0.0.1:${port}`, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token },
    forceNew: true,
    reconnection: false,
  });
}

function waitForConnect(socket: ClientSocket, timeoutMs = 5_000): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      reject(new Error("Timed out waiting for socket connect"));
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timer);
      socket.off("connect_error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      reject(error);
    };
    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("notification realtime socket", { timeout: 120_000 }, () => {
  const createdUserIds: string[] = [];
  let httpServer: HttpServer | undefined;
  let port = 0;
  let stamp = "";
  let adminId = "";
  let receptionistId = "";
  let adminToken = "";
  let receptionistToken = "";

  before(async () => {
    await connectDatabase();
    stamp = `node.rt.${Date.now()}`;

    const admin = await User.create({
      full_name: "Realtime Admin",
      email: `${stamp}.admin@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "ADMIN",
      is_active: true,
      is_deleted: false,
    });
    const receptionist = await User.create({
      full_name: "Realtime Desk",
      email: `${stamp}.desk@example.com`,
      password: await hashDjangoPassword(PASSWORD),
      role: "RECEPTIONIST",
      is_active: true,
      is_deleted: false,
    });

    adminId = String(admin._id);
    receptionistId = String(receptionist._id);
    createdUserIds.push(adminId, receptionistId);
    adminToken = accessFor(admin);
    receptionistToken = accessFor(receptionist);

    httpServer = createServer(createApp());
    attachRealtime(httpServer);
    await new Promise<void>((resolve, reject) => {
      httpServer?.listen(0, "127.0.0.1", () => resolve());
      httpServer?.once("error", reject);
    });
    const address = httpServer.address() as AddressInfo;
    port = address.port;
  });

  after(async () => {
    await closeRealtime();
    if (httpServer?.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    if (createdUserIds.length > 0) {
      await Notification.deleteMany({ user_id: { $in: createdUserIds } }).exec();
      await User.deleteMany({ _id: { $in: createdUserIds } }).exec();
    }
    await disconnectDatabase();
  });

  it("rejects unauthenticated socket connections", async () => {
    const socket = connectClient(port, "not-a-valid-token");
    await assert.rejects(waitForConnect(socket, 3_000));
    socket.disconnect();
  });

  it("emits a created notification only to the intended user", async () => {
    const adminSocket = connectClient(port, adminToken);
    const deskSocket = connectClient(port, receptionistToken);
    await Promise.all([waitForConnect(adminSocket), waitForConnect(deskSocket)]);

    const relatedId = `rt-admin-${stamp}`;
    const adminReceived = waitForEvent<{ notification: { id: string; user_id: string; title: string } }>(
      adminSocket,
      NOTIFICATION_CREATED_EVENT,
    );
    let deskSawEvent = false;
    deskSocket.once(NOTIFICATION_CREATED_EVENT, () => {
      deskSawEvent = true;
    });

    const created = await notifyStaff({
      type: NotificationType.QUEUE,
      title: "Patient waiting",
      message: "Token A-1 is waiting.",
      related_id: relatedId,
      patient_name: "Realtime Patient",
      token_number: "A-1",
      visit_number: 1,
      roles: ADMIN_ROLES,
    });
    assert.ok(created >= 1);

    const payload = await adminReceived;
    assert.equal(payload.notification.user_id, adminId);
    assert.equal(payload.notification.title, "Patient waiting");
    assert.ok(payload.notification.id);

    await waitMs(400);
    assert.equal(deskSawEvent, false);

    adminSocket.disconnect();
    deskSocket.disconnect();
  });

  it("emits removal when queue notifications are resolved", async () => {
    const adminSocket = connectClient(port, adminToken);
    await waitForConnect(adminSocket);

    const relatedId = `q:rt-resolve-${stamp}`.slice(0, 64);
    const created = await notifyStaff({
      type: NotificationType.QUEUE,
      title: "Patient waiting",
      message: "Token B-2 is waiting.",
      related_id: relatedId,
      patient_name: "Resolve Patient",
      token_number: "B-2",
      visit_number: 1,
      roles: ADMIN_ROLES,
    });
    assert.ok(created >= 1);

    const note = await Notification.findOne({ user_id: adminId, related_id: relatedId }).exec();
    assert.ok(note);

    const removed = waitForEvent<{ id: string }>(adminSocket, NOTIFICATION_REMOVED_EVENT);
    const deleted = await resolveQueueNotifications(`rt-resolve-${stamp}`);
    assert.ok(deleted >= 1);

    const payload = await removed;
    assert.equal(payload.id, String(note._id));

    adminSocket.disconnect();
  });
});
