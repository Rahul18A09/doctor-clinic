import type { ClinicSettingsPayload } from "./defaults";
import { toDjangoIso } from "../auth/iso";
import type { ISettings } from "../models/settings.model";

export function serializeSettings(doc: ISettings): ClinicSettingsPayload & {
  updated_at: string | null;
} {
  return {
    clinic: {
      name: doc.clinic.name,
      phone: doc.clinic.phone,
      email: doc.clinic.email,
      address: doc.clinic.address,
      working_days: doc.clinic.working_days,
      opening_time: doc.clinic.opening_time,
      closing_time: doc.clinic.closing_time,
    },
    queue: {
      token_format: doc.queue.token_format,
      daily_token_reset: Boolean(doc.queue.daily_token_reset),
      queue_start_time: doc.queue.queue_start_time,
      queue_end_time: doc.queue.queue_end_time,
      max_daily_tokens: doc.queue.max_daily_tokens ?? null,
    },
    notifications: {
      patient_registration: Boolean(doc.notifications.patient_registration),
      token_generated: Boolean(doc.notifications.token_generated),
      token_approaching: Boolean(doc.notifications.token_approaching),
      consultation_completed: Boolean(doc.notifications.consultation_completed),
    },
    preferences: {
      date_format: doc.preferences.date_format,
      time_format: doc.preferences.time_format,
      timezone: doc.preferences.timezone,
      language: doc.preferences.language,
    },
    updated_at: toDjangoIso(doc.updated_at),
  };
}
