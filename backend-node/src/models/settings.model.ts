import { Schema, model, type HydratedDocument } from "mongoose";

import {
  DATE_FORMATS,
  DEFAULT_SETTINGS,
  LANGUAGES,
  SETTINGS_KEY,
  TIME_FORMATS,
  TIMEZONES,
  WORKING_DAYS,
  type ClinicSettings,
  type NotificationSettings,
  type PreferenceSettings,
  type QueueSettings,
} from "../settings/defaults";

export interface ISettings {
  key: string;
  clinic: ClinicSettings;
  queue: QueueSettings;
  notifications: NotificationSettings;
  preferences: PreferenceSettings;
  created_at: Date;
  updated_at: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, default: SETTINGS_KEY },
    clinic: {
      name: { type: String, required: true, maxlength: 255 },
      phone: { type: String, required: true, maxlength: 30 },
      email: { type: String, required: true },
      address: { type: String, required: true, maxlength: 500 },
      working_days: { type: String, required: true, enum: WORKING_DAYS },
      opening_time: { type: String, required: true },
      closing_time: { type: String, required: true },
    },
    queue: {
      token_format: { type: String, required: true, maxlength: 2 },
      daily_token_reset: { type: Boolean, required: true },
      queue_start_time: { type: String, required: true },
      queue_end_time: { type: String, required: true },
      max_daily_tokens: { type: Number, default: null },
    },
    notifications: {
      patient_registration: { type: Boolean, required: true },
      token_generated: { type: Boolean, required: true },
      token_approaching: { type: Boolean, required: true },
      consultation_completed: { type: Boolean, required: true },
    },
    preferences: {
      date_format: { type: String, required: true, enum: DATE_FORMATS },
      time_format: { type: String, required: true, enum: TIME_FORMATS },
      timezone: { type: String, required: true, enum: TIMEZONES },
      language: { type: String, required: true, enum: LANGUAGES },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "clinic_settings",
    versionKey: false,
    timestamps: false,
    autoIndex: false,
    autoCreate: false,
    strict: true,
  },
);

settingsSchema.pre("save", function () {
  const now = new Date();
  if (this.isNew && !this.created_at) {
    this.created_at = now;
  }
  this.updated_at = now;
});

export type SettingsDocument = HydratedDocument<ISettings>;

export const Settings = model<ISettings>("Settings", settingsSchema);

export async function getOrCreateSettings(): Promise<SettingsDocument> {
  const existing = await Settings.findOne({ key: SETTINGS_KEY }).exec();
  if (existing) {
    return existing;
  }
  return Settings.create({
    key: SETTINGS_KEY,
    ...DEFAULT_SETTINGS,
  });
}
