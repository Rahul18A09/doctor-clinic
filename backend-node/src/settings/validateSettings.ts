import type { FieldErrors } from "../http/errors";
import { hasFieldErrors } from "../http/errors";
import {
  collectFieldErrors,
  readRequiredChoice,
  readRequiredEmail,
  readRequiredInt,
  readRequiredString,
  ValidationMessage,
} from "../http/validation";
import {
  DATE_FORMATS,
  LANGUAGES,
  TIME_FORMATS,
  TIMEZONES,
  WORKING_DAYS,
  type ClinicSettings,
  type NotificationSettings,
  type PreferenceSettings,
  type QueueSettings,
} from "./defaults";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TOKEN_FORMAT_RE = /^\d{2}$/;

function readRequiredBoolean(
  source: Record<string, unknown>,
  field: string,
): { value?: boolean; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [ValidationMessage.required] };
  }
  if (source[field] === null) {
    return { errors: [ValidationMessage.null] };
  }
  if (typeof source[field] === "boolean") {
    return { value: source[field], errors: [] };
  }
  return { errors: ["Must be a valid boolean."] };
}

function readRequiredTime(
  source: Record<string, unknown>,
  field: string,
): { value?: string; errors: string[] } {
  const result = readRequiredString(source, field, { maxLength: 5 });
  if (result.errors.length > 0 || result.value === undefined) {
    return result;
  }
  if (!TIME_RE.test(result.value)) {
    return { errors: ["Enter a valid time as HH:MM."] };
  }
  return { value: result.value, errors: [] };
}

function minutesFromHhMm(value: string): number {
  const [hours = 0, minutes = 0] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

function readOptionalMaxTokens(
  source: Record<string, unknown>,
): { value?: number | null; errors: string[] } {
  if (!("max_daily_tokens" in source) || source.max_daily_tokens === undefined) {
    return { value: null, errors: [] };
  }
  if (source.max_daily_tokens === null || source.max_daily_tokens === "") {
    return { value: null, errors: [] };
  }
  return readRequiredInt(source, "max_daily_tokens", { min: 1, max: 9999 });
}

export function validateClinicSettings(
  body: Record<string, unknown>,
): { ok: true; value: ClinicSettings } | { ok: false; errors: FieldErrors } {
  const name = readRequiredString(body, "name", { maxLength: 255 });
  const phone = readRequiredString(body, "phone", { maxLength: 30 });
  const email = readRequiredEmail(body, "email");
  const address = readRequiredString(body, "address", { maxLength: 500 });
  const workingDays = readRequiredChoice(body, "working_days", WORKING_DAYS);
  const openingTime = readRequiredTime(body, "opening_time");
  const closingTime = readRequiredTime(body, "closing_time");

  const errors = collectFieldErrors({
    name,
    phone,
    email,
    address,
    working_days: workingDays,
    opening_time: openingTime,
    closing_time: closingTime,
  });

  if (
    !hasFieldErrors(errors) &&
    openingTime.value &&
    closingTime.value &&
    minutesFromHhMm(openingTime.value) >= minutesFromHhMm(closingTime.value)
  ) {
    errors.closing_time = ["Closing time must be after opening time."];
  }

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: name.value as string,
      phone: phone.value as string,
      email: email.value as string,
      address: address.value as string,
      working_days: workingDays.value as ClinicSettings["working_days"],
      opening_time: openingTime.value as string,
      closing_time: closingTime.value as string,
    },
  };
}

export function validateQueueSettings(
  body: Record<string, unknown>,
): { ok: true; value: QueueSettings } | { ok: false; errors: FieldErrors } {
  const tokenFormat = readRequiredString(body, "token_format", { maxLength: 2 });
  if (tokenFormat.value && !TOKEN_FORMAT_RE.test(tokenFormat.value)) {
    tokenFormat.errors.push("Token format must be 2 digits, for example 01.");
  }
  const dailyReset = readRequiredBoolean(body, "daily_token_reset");
  const startTime = readRequiredTime(body, "queue_start_time");
  const endTime = readRequiredTime(body, "queue_end_time");
  const maxTokens = readOptionalMaxTokens(body);

  const errors = collectFieldErrors({
    token_format: tokenFormat,
    daily_token_reset: dailyReset,
    queue_start_time: startTime,
    queue_end_time: endTime,
    max_daily_tokens: maxTokens,
  });

  if (
    !hasFieldErrors(errors) &&
    startTime.value &&
    endTime.value &&
    minutesFromHhMm(startTime.value) >= minutesFromHhMm(endTime.value)
  ) {
    errors.queue_end_time = ["Queue end time must be after start time."];
  }

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      token_format: tokenFormat.value as string,
      daily_token_reset: dailyReset.value as boolean,
      queue_start_time: startTime.value as string,
      queue_end_time: endTime.value as string,
      max_daily_tokens: maxTokens.value ?? null,
    },
  };
}

export function validateNotificationSettings(
  body: Record<string, unknown>,
): { ok: true; value: NotificationSettings } | { ok: false; errors: FieldErrors } {
  const patientRegistration = readRequiredBoolean(body, "patient_registration");
  const tokenGenerated = readRequiredBoolean(body, "token_generated");
  const tokenApproaching = readRequiredBoolean(body, "token_approaching");
  const consultationCompleted = readRequiredBoolean(body, "consultation_completed");

  const errors = collectFieldErrors({
    patient_registration: patientRegistration,
    token_generated: tokenGenerated,
    token_approaching: tokenApproaching,
    consultation_completed: consultationCompleted,
  });

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      patient_registration: patientRegistration.value as boolean,
      token_generated: tokenGenerated.value as boolean,
      token_approaching: tokenApproaching.value as boolean,
      consultation_completed: consultationCompleted.value as boolean,
    },
  };
}

export function validatePreferenceSettings(
  body: Record<string, unknown>,
): { ok: true; value: PreferenceSettings } | { ok: false; errors: FieldErrors } {
  const dateFormat = readRequiredChoice(body, "date_format", DATE_FORMATS);
  const timeFormat = readRequiredChoice(body, "time_format", TIME_FORMATS);
  const timezone = readRequiredChoice(body, "timezone", TIMEZONES);
  const language = readRequiredChoice(body, "language", LANGUAGES);

  const errors = collectFieldErrors({
    date_format: dateFormat,
    time_format: timeFormat,
    timezone,
    language,
  });

  if (hasFieldErrors(errors)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      date_format: dateFormat.value as PreferenceSettings["date_format"],
      time_format: timeFormat.value as PreferenceSettings["time_format"],
      timezone: timezone.value as PreferenceSettings["timezone"],
      language: language.value as PreferenceSettings["language"],
    },
  };
}
