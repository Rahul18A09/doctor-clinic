import { BLOOD_GROUPS, GENDERS, PATIENT_STATUSES } from "../constants";
import type { BloodGroup, Gender, PatientStatus } from "../constants";
import type { FieldErrors } from "./errors";

export const ValidationMessage = {
  required: "This field is required.",
  blank: "This field may not be blank.",
  null: "This field may not be null.",
  invalidEmail: "Enter a valid email address.",
  invalidInteger: "A valid integer is required.",
  invalidNumber: "A valid number is required.",
  maxLength: (max: number): string =>
    `Ensure this field has no more than ${max} characters.`,
  minValue: (min: number): string =>
    `Ensure this value is greater than or equal to ${min}.`,
  maxValue: (max: number): string =>
    `Ensure this value is less than or equal to ${max}.`,
  invalidChoice: (value: string): string => `"${value}" is not a valid choice.`,
} as const;

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const INTEGER_STRING_RE = /^[-+]?\d+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function isMongoObjectId(value: string): boolean {
  return OBJECT_ID_RE.test(value);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive contains, matching MongoEngine `icontains`. */
export function icontainsRegex(search: string): { $regex: string; $options: "i" } {
  return { $regex: escapeRegex(search), $options: "i" };
}

export function readQueryString(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function readBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function stringifyChar(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function readRequiredString(
  source: Record<string, unknown>,
  field: string,
  options: { maxLength?: number; strip?: boolean } = {},
): { value?: string; errors: string[] } {
  const strip = options.strip ?? true;
  if (!(field in source) || source[field] === undefined) {
    return { errors: [ValidationMessage.required] };
  }
  if (source[field] === null) {
    return { errors: [ValidationMessage.null] };
  }
  const raw = stringifyChar(source[field]);
  if (raw === undefined) {
    return { errors: [ValidationMessage.blank] };
  }
  const value = strip ? raw.trim() : raw;
  if (value === "") {
    return { errors: [ValidationMessage.blank] };
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return { errors: [ValidationMessage.maxLength(options.maxLength)] };
  }
  return { value, errors: [] };
}

export function readOptionalString(
  source: Record<string, unknown>,
  field: string,
  options: { maxLength?: number; strip?: boolean; allowBlank?: boolean } = {},
): { value?: string; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [] };
  }
  if (source[field] === null) {
    return { errors: [ValidationMessage.null] };
  }
  const raw = stringifyChar(source[field]);
  if (raw === undefined) {
    return { errors: [ValidationMessage.blank] };
  }
  const strip = options.strip ?? true;
  const value = strip ? raw.trim() : raw;
  if (value === "" && options.allowBlank !== true) {
    return { errors: [ValidationMessage.blank] };
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return { errors: [ValidationMessage.maxLength(options.maxLength)] };
  }
  return { value, errors: [] };
}

export function readRequiredEmail(
  source: Record<string, unknown>,
  field = "email",
): { value?: string; errors: string[] } {
  const result = readRequiredString(source, field);
  if (result.errors.length > 0 || result.value === undefined) {
    return result;
  }
  const email = result.value.toLowerCase();
  if (!isValidEmail(email)) {
    return { errors: [ValidationMessage.invalidEmail] };
  }
  return { value: email, errors: [] };
}

export function readOptionalEmail(
  source: Record<string, unknown>,
  field = "email",
): { value?: string; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [] };
  }
  return readRequiredEmail(source, field);
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!INTEGER_STRING_RE.test(trimmed)) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function readRequiredInt(
  source: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
): { value?: number; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [ValidationMessage.required] };
  }
  if (source[field] === null) {
    return { errors: [ValidationMessage.null] };
  }
  const value = parseInteger(source[field]);
  if (value === undefined) {
    return { errors: [ValidationMessage.invalidInteger] };
  }
  if (options.min !== undefined && value < options.min) {
    return { errors: [ValidationMessage.minValue(options.min)] };
  }
  if (options.max !== undefined && value > options.max) {
    return { errors: [ValidationMessage.maxValue(options.max)] };
  }
  return { value, errors: [] };
}

export function readOptionalInt(
  source: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
): { value?: number; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [] };
  }
  return readRequiredInt(source, field, options);
}

function parseFloatValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) {
      return undefined;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** DRF FloatField(required=False, allow_null=True). */
export function readOptionalNullableFloat(
  source: Record<string, unknown>,
  field: string,
): { assigned: boolean; value?: number | null; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { assigned: false, errors: [] };
  }
  if (source[field] === null) {
    return { assigned: true, value: null, errors: [] };
  }
  const value = parseFloatValue(source[field]);
  if (value === undefined) {
    return { assigned: true, errors: [ValidationMessage.invalidNumber] };
  }
  return { assigned: true, value, errors: [] };
}

export function readRequiredChoice<T extends string>(
  source: Record<string, unknown>,
  field: string,
  choices: readonly T[],
): { value?: T; errors: string[] } {
  const result = readRequiredString(source, field);
  if (result.errors.length > 0 || result.value === undefined) {
    return { errors: result.errors };
  }
  if (!(choices as readonly string[]).includes(result.value)) {
    return { errors: [ValidationMessage.invalidChoice(result.value)] };
  }
  return { value: result.value as T, errors: [] };
}

export function readOptionalChoice<T extends string>(
  source: Record<string, unknown>,
  field: string,
  choices: readonly T[],
  options: { allowBlank?: boolean } = {},
): { value?: T | ""; errors: string[] } {
  if (!(field in source) || source[field] === undefined) {
    return { errors: [] };
  }
  if (source[field] === null) {
    return { errors: [ValidationMessage.null] };
  }
  const raw = stringifyChar(source[field]);
  if (raw === undefined) {
    return { errors: [ValidationMessage.blank] };
  }
  const value = raw.trim();
  if (value === "") {
    if (options.allowBlank === true) {
      return { value: "", errors: [] };
    }
    return { errors: [ValidationMessage.blank] };
  }
  if (!(choices as readonly string[]).includes(value)) {
    return { errors: [ValidationMessage.invalidChoice(value)] };
  }
  return { value: value as T, errors: [] };
}

export function collectFieldErrors(
  fields: Record<string, { errors: string[] }>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, result] of Object.entries(fields)) {
    if (result.errors.length > 0) {
      errors[field] = result.errors;
    }
  }
  return errors;
}

export function readGender(source: Record<string, unknown>, required: boolean) {
  return required
    ? readRequiredChoice<Gender>(source, "gender", GENDERS)
    : readOptionalChoice<Gender>(source, "gender", GENDERS);
}

export function readBloodGroup(source: Record<string, unknown>, required: boolean) {
  return required
    ? readRequiredChoice<BloodGroup>(source, "blood_group", BLOOD_GROUPS)
    : readOptionalChoice<BloodGroup>(source, "blood_group", BLOOD_GROUPS, {
        allowBlank: true,
      });
}

export function readPatientStatus(
  source: Record<string, unknown>,
  field = "status",
): { value?: PatientStatus; errors: string[] } {
  const value = readQueryString(source[field]);
  if (!value) {
    return { errors: [] };
  }
  if (!(PATIENT_STATUSES as readonly string[]).includes(value)) {
    return { errors: [] };
  }
  return { value: value as PatientStatus, errors: [] };
}
