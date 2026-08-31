import { toDjangoIso } from "../auth/iso";
import type { NotificationDocument } from "../models/notification.model";
import { normalizeStoredType } from "./visibility";

export type SerializedNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  related_id: string;
  patient_name: string;
  token_number: string;
  visit_number: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export function serializeNotification(doc: NotificationDocument): SerializedNotification {
  return {
    id: String(doc._id),
    user_id: doc.user_id,
    type: normalizeStoredType(doc.type),
    title: doc.title,
    message: doc.message,
    is_read: doc.is_read,
    read_at: toDjangoIso(doc.read_at),
    related_id: doc.related_id ?? "",
    patient_name: doc.patient_name ?? "",
    token_number: doc.token_number ?? "",
    visit_number: Number.isFinite(Number(doc.visit_number)) ? Number(doc.visit_number) : null,
    created_at: toDjangoIso(doc.created_at),
    updated_at: toDjangoIso(doc.updated_at),
  };
}
