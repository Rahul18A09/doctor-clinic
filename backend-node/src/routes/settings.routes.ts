import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { firstErrorMessage } from "../http/errors";
import { errorResponse, successResponse } from "../http/responses";
import { readBody } from "../http/validation";
import { authenticate } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/authorize";
import { getOrCreateSettings } from "../models/settings.model";
import { serializeSettings } from "../settings/serializeSettings";
import {
  validateClinicSettings,
  validateNotificationSettings,
  validatePreferenceSettings,
  validateQueueSettings,
} from "../settings/validateSettings";

function settingsData(doc: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  return { settings: serializeSettings(doc) };
}

const getSettings: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
  const doc = await getOrCreateSettings();
  successResponse(res, {
    message: "Settings retrieved successfully.",
    data: settingsData(doc),
  });
};

const patchClinic: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateClinicSettings(readBody(req.body));
  if (!parsed.ok) {
    errorResponse(res, {
      message: firstErrorMessage(parsed.errors, "Clinic settings update failed."),
      errors: parsed.errors,
      statusCode: 400,
    });
    return;
  }
  const doc = await getOrCreateSettings();
  doc.clinic = parsed.value;
  doc.markModified("clinic");
  await doc.save();
  successResponse(res, {
    message: "Clinic settings updated successfully.",
    data: settingsData(doc),
  });
};

const patchQueue: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateQueueSettings(readBody(req.body));
  if (!parsed.ok) {
    errorResponse(res, {
      message: firstErrorMessage(parsed.errors, "Queue settings update failed."),
      errors: parsed.errors,
      statusCode: 400,
    });
    return;
  }
  const doc = await getOrCreateSettings();
  doc.queue = parsed.value;
  doc.markModified("queue");
  await doc.save();
  successResponse(res, {
    message: "Queue settings updated successfully.",
    data: settingsData(doc),
  });
};

const patchNotifications: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validateNotificationSettings(readBody(req.body));
  if (!parsed.ok) {
    errorResponse(res, {
      message: firstErrorMessage(parsed.errors, "Notification settings update failed."),
      errors: parsed.errors,
      statusCode: 400,
    });
    return;
  }
  const doc = await getOrCreateSettings();
  doc.notifications = parsed.value;
  doc.markModified("notifications");
  await doc.save();
  successResponse(res, {
    message: "Notification settings updated successfully.",
    data: settingsData(doc),
  });
};

const patchPreferences: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = validatePreferenceSettings(readBody(req.body));
  if (!parsed.ok) {
    errorResponse(res, {
      message: firstErrorMessage(parsed.errors, "System preferences update failed."),
      errors: parsed.errors,
      statusCode: 400,
    });
    return;
  }
  const doc = await getOrCreateSettings();
  doc.preferences = parsed.value;
  doc.markModified("preferences");
  await doc.save();
  successResponse(res, {
    message: "System preferences updated successfully.",
    data: settingsData(doc),
  });
};

const settingsRouter = Router();

settingsRouter.get("/", authenticate, requireAdmin, getSettings);
settingsRouter.get("", authenticate, requireAdmin, getSettings);
settingsRouter.patch("/clinic/", authenticate, requireAdmin, patchClinic);
settingsRouter.patch("/clinic", authenticate, requireAdmin, patchClinic);
settingsRouter.patch("/queue/", authenticate, requireAdmin, patchQueue);
settingsRouter.patch("/queue", authenticate, requireAdmin, patchQueue);
settingsRouter.patch("/notifications/", authenticate, requireAdmin, patchNotifications);
settingsRouter.patch("/notifications", authenticate, requireAdmin, patchNotifications);
settingsRouter.patch("/preferences/", authenticate, requireAdmin, patchPreferences);
settingsRouter.patch("/preferences", authenticate, requireAdmin, patchPreferences);

export default settingsRouter;
