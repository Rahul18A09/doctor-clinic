import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { NOTIFICATION_TYPES, UserRole, type NotificationType } from "../constants";
import { hasFieldErrors, type FieldErrors } from "../http/errors";
import { buildPaginationMeta, parsePagination } from "../http/pagination";
import {
  notFoundResponse,
  paginatedSuccessResponse,
  successResponse,
  validationErrorResponse,
} from "../http/responses";
import {
  isMongoObjectId,
  readQueryString,
  ValidationMessage,
} from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { canAccessNotifications } from "../middleware/authorize";
import { Notification, type NotificationDocument } from "../models/notification.model";
import { serializeNotification } from "../notifications/serializeNotification";
import {
  expandRequestedType,
  typesVisibleToRole,
  visibleNotificationMongoFilter,
} from "../notifications/visibility";

const NOT_FOUND = "Notification not found.";

type ListFilters = {
  type?: NotificationType;
  is_read?: boolean;
};

function parseBooleanQuery(raw: string): { value?: boolean; errors: string[] } {
  if (!raw) {
    return { errors: [] };
  }
  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return { value: true, errors: [] };
  }
  if (normalized === "false" || normalized === "0") {
    return { value: false, errors: [] };
  }
  return { errors: [ValidationMessage.invalidChoice(raw)] };
}

function validateListQuery(
  query: Record<string, unknown>,
): { ok: true; value: ListFilters } | { ok: false; errors: FieldErrors } {
  const typeRaw = readQueryString(query.type);
  const isReadRaw = readQueryString(query.is_read);
  const errors: FieldErrors = {};

  let type: NotificationType | undefined;
  if (typeRaw) {
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(typeRaw)) {
      errors.type = [ValidationMessage.invalidChoice(typeRaw)];
    } else {
      type = typeRaw as NotificationType;
    }
  }

  const isRead = parseBooleanQuery(isReadRaw);
  if (isRead.errors.length > 0) {
    errors.is_read = isRead.errors;
  }

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }
  const value: ListFilters = {};
  if (type) {
    value.type = type;
  }
  if (isRead.value !== undefined) {
    value.is_read = isRead.value;
  }
  return { ok: true, value };
}

function buildVisibleFilter(
  role: typeof UserRole.ADMIN | typeof UserRole.RECEPTIONIST,
  extra: ListFilters,
): Record<string, unknown> | null {
  const allowed = typesVisibleToRole(role);
  let types = allowed;
  if (extra.type) {
    const requested = expandRequestedType(extra.type);
    types = requested.filter((type) => allowed.includes(type));
    if (types.length === 0) {
      return null;
    }
  }
  return {
    ...visibleNotificationMongoFilter(role),
    type: { $in: types },
    ...(extra.is_read !== undefined ? { is_read: extra.is_read } : {}),
  };
}

async function findOwnNotificationOr404(
  id: string,
  userId: string,
  res: Response,
): Promise<NotificationDocument | null> {
  if (!isMongoObjectId(id)) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  const notification = await Notification.findOne({ _id: id, user_id: userId }).exec();
  if (!notification) {
    notFoundResponse(res, NOT_FOUND);
    return null;
  }
  return notification;
}

const listNotifications: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    return;
  }
  const parsedFilters = validateListQuery(req.query as Record<string, unknown>);
  if (!parsedFilters.ok) {
    validationErrorResponse(res, parsedFilters.errors);
    return;
  }

  const parsed = parsePagination(req.query);
  const visibility = buildVisibleFilter(user.role, parsedFilters.value);
  if (!visibility) {
    paginatedSuccessResponse(res, {
      message: "Notifications retrieved successfully.",
      results: [],
      pagination: buildPaginationMeta(parsed, 0),
    });
    return;
  }
  const filter: Record<string, unknown> = { user_id: user.id, ...visibility };

  const total = await Notification.countDocuments(filter).exec();
  const notifications = await Notification.find(filter)
    .sort({ created_at: -1 })
    .skip(parsed.skip)
    .limit(parsed.limit)
    .exec();

  paginatedSuccessResponse(res, {
    message: "Notifications retrieved successfully.",
    results: notifications.map(serializeNotification),
    pagination: buildPaginationMeta(parsed, total),
  });
};

const unreadCount: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    return;
  }
  const unread_count = await Notification.countDocuments({
    user_id: user.id,
    is_read: false,
    ...visibleNotificationMongoFilter(user.role),
  }).exec();
  successResponse(res, {
    message: "Unread notification count retrieved successfully.",
    data: { unread_count },
  });
};

const markRead: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    return;
  }
  const notification = await findOwnNotificationOr404(String(req.params["id"] ?? ""), user.id, res);
  if (!notification) {
    return;
  }
  if (!notification.is_read) {
    const now = new Date();
    notification.is_read = true;
    notification.read_at = now;
    notification.updated_at = now;
    await notification.save();
  }
  successResponse(res, {
    message: "Notification marked as read.",
    data: { notification: serializeNotification(notification) },
  });
};

const markAllRead: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    return;
  }
  const now = new Date();
  const result = await Notification.updateMany(
    {
      user_id: user.id,
      is_read: false,
      ...visibleNotificationMongoFilter(user.role),
    },
    { $set: { is_read: true, read_at: now, updated_at: now } },
  ).exec();
  successResponse(res, {
    message: "All notifications marked as read.",
    data: { updated: result.modifiedCount },
  });
};

const deleteNotification: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    return;
  }
  const notification = await findOwnNotificationOr404(String(req.params["id"] ?? ""), user.id, res);
  if (!notification) {
    return;
  }
  await notification.deleteOne();
  successResponse(res, { message: "Notification deleted successfully." });
};

const notificationsRouter = Router();
const staffOnly: RequestHandler[] = [authenticate, canAccessNotifications];

notificationsRouter.get("/", ...staffOnly, listNotifications);
notificationsRouter.get("", ...staffOnly, listNotifications);
notificationsRouter.get("/unread-count/", ...staffOnly, unreadCount);
notificationsRouter.get("/unread-count", ...staffOnly, unreadCount);
notificationsRouter.patch("/read-all/", ...staffOnly, markAllRead);
notificationsRouter.patch("/read-all", ...staffOnly, markAllRead);
notificationsRouter.patch("/:id/read/", ...staffOnly, markRead);
notificationsRouter.patch("/:id/read", ...staffOnly, markRead);
notificationsRouter.delete("/:id/", ...staffOnly, deleteNotification);
notificationsRouter.delete("/:id", ...staffOnly, deleteNotification);

export default notificationsRouter;
