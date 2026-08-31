import { Notification } from "../models/notification.model";
import { INTERNAL_NOTIFICATION_MONGO_RE } from "./messages";

export function internalNotificationMongoFilter(): Record<string, unknown> {
  const pattern = { $regex: INTERNAL_NOTIFICATION_MONGO_RE, $options: "i" };
  return {
    $or: [{ title: pattern }, { message: pattern }],
  };
}

export async function deleteInternalNotifications(): Promise<number> {
  const result = await Notification.deleteMany(internalNotificationMongoFilter()).exec();
  return result.deletedCount;
}
