export const SETTINGS_KEY = "default";

export const WORKING_DAYS = [
  "MONDAY_FRIDAY",
  "MONDAY_SATURDAY",
  "EVERY_DAY",
] as const;

export type WorkingDays = (typeof WORKING_DAYS)[number];

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ["12_HOUR", "24_HOUR"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
] as const;
export type Timezone = (typeof TIMEZONES)[number];

export const LANGUAGES = ["en", "hi", "gu"] as const;
export type Language = (typeof LANGUAGES)[number];

export type ClinicSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  working_days: WorkingDays;
  opening_time: string;
  closing_time: string;
};

export type QueueSettings = {
  token_format: string;
  daily_token_reset: boolean;
  queue_start_time: string;
  queue_end_time: string;
  max_daily_tokens: number | null;
};

export type NotificationSettings = {
  patient_registration: boolean;
  token_generated: boolean;
  token_approaching: boolean;
  consultation_completed: boolean;
};

export type PreferenceSettings = {
  date_format: DateFormat;
  time_format: TimeFormat;
  timezone: Timezone;
  language: Language;
};

export type ClinicSettingsPayload = {
  clinic: ClinicSettings;
  queue: QueueSettings;
  notifications: NotificationSettings;
  preferences: PreferenceSettings;
};

export const DEFAULT_SETTINGS: ClinicSettingsPayload = {
  clinic: {
    name: "Doctor Clinic",
    phone: "+91 98765 43210",
    email: "clinic@example.com",
    address: "123, Health Street, Medical Road",
    working_days: "MONDAY_SATURDAY",
    opening_time: "09:00",
    closing_time: "18:00",
  },
  queue: {
    token_format: "01",
    daily_token_reset: true,
    queue_start_time: "09:00",
    queue_end_time: "18:00",
    max_daily_tokens: 200,
  },
  notifications: {
    patient_registration: true,
    token_generated: true,
    token_approaching: true,
    consultation_completed: true,
  },
  preferences: {
    date_format: "DD/MM/YYYY",
    time_format: "12_HOUR",
    timezone: "Asia/Kolkata",
    language: "en",
  },
};
