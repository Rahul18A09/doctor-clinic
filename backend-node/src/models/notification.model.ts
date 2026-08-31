import { Schema, model, type HydratedDocument } from "mongoose";

import {
  NOTIFICATION_TYPES,
  NotificationType,
  type NotificationType as NotificationTypeValue,
} from "../constants";

export interface INotification {
  user_id: string;
  type: NotificationTypeValue;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: Date;
  related_id?: string;
  patient_name?: string;
  token_number?: string;
  visit_number?: number;
  created_at: Date;
  updated_at: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
      default: NotificationType.SYSTEM,
    },
    title: { type: String, required: true, maxlength: 255 },
    message: { type: String, required: true, maxlength: 1000 },
    is_read: { type: Boolean, required: true, default: false },
    read_at: { type: Date },
    related_id: { type: String, maxlength: 64 },
    patient_name: { type: String, maxlength: 255 },
    token_number: { type: String, maxlength: 20 },
    visit_number: { type: Number, min: 1 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "notifications",
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
    strict: true,
  },
);

notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, is_read: 1 });

notificationSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type NotificationDocument = HydratedDocument<INotification>;

export const Notification = model<INotification>("Notification", notificationSchema);
