import { Types } from "mongoose";

import { getTodayUtcRange } from "../http/utc";
import { icontainsRegex, isMongoObjectId } from "../http/validation";
import { Patient, type PatientDocument } from "../models/patient.model";
import { nextStoredToken } from "./tokens";

export async function generateTokenNumber(now: Date = new Date()): Promise<string> {
  const { start, end } = getTodayUtcRange(now);
  const patients = await Patient.find({
    created_at: { $gte: start, $lt: end },
  })
    .select("token_number")
    .lean()
    .exec();
  return nextStoredToken(
    patients.map((patient) => patient.token_number ?? ""),
    now,
  );
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

export function classifyLookupQuery(query: string): {
  mobile?: string;
  patientId?: string;
  patientName?: string;
} {
  const trimmed = query.trim();
  if (!trimmed) {
    return {};
  }
  if (isMongoObjectId(trimmed)) {
    return { patientId: trimmed };
  }
  if (/^\d+$/.test(trimmed)) {
    return { mobile: trimmed };
  }
  return { patientName: trimmed };
}

/** Mask all but the last 4 digits, e.g. `9876543210` → `******3210`. */
export function maskMobile(mobile: string): string {
  const digits = mobile.trim();
  if (!digits) {
    return "";
  }
  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function identityMatchesName(identity: PatientIdentity, patientName: string): boolean {
  const query = patientName.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return identity.visits.some((visit) => visit.patient_name.toLowerCase().includes(query));
}

export function permanentPatientId(patient: {
  _id?: { toString(): string };
  id?: string;
  patient_id?: string | null;
}): string {
  const stored = patient.patient_id?.trim();
  if (stored) {
    return stored;
  }
  return patient.id ?? String(patient._id ?? "");
}

function identityFilter(seed: {
  _id: { toString(): string };
  mobile: string;
  patient_id?: string | null;
}): Record<string, unknown> {
  const patientId = permanentPatientId(seed);
  const clauses: Record<string, unknown>[] = [{ patient_id: patientId }, { mobile: seed.mobile }];
  if (isMongoObjectId(patientId)) {
    clauses.push({ _id: patientId });
  }
  return { $or: clauses };
}

export async function getLatestPatientByMobile(mobile: string) {
  const trimmed = mobile.trim();
  if (!trimmed) {
    return null;
  }
  return Patient.findOne({ mobile: trimmed }).sort({ created_at: -1 }).exec();
}

export async function getVisitCount(mobile: string): Promise<number> {
  const trimmed = mobile.trim();
  if (!trimmed) {
    return 0;
  }
  return Patient.countDocuments({ mobile: trimmed }).exec();
}

export async function getNextVisitNumber(mobile: string): Promise<number> {
  return (await getVisitCount(mobile)) + 1;
}

export type PatientIdentity = {
  patientId: string;
  mobile: string;
  visitCount: number;
  latest: PatientDocument;
  oldest: PatientDocument;
  visits: PatientDocument[];
};

async function loadIdentityFromSeed(seed: PatientDocument): Promise<PatientIdentity> {
  const visits = await Patient.find(identityFilter(seed)).sort({ created_at: -1 }).exec();
  const oldest = visits[visits.length - 1] ?? seed;
  const latest = visits[0] ?? seed;
  const patientId = permanentPatientId(oldest);
  return {
    patientId,
    mobile: latest.mobile,
    visitCount: visits.length,
    latest,
    oldest,
    visits,
  };
}

export async function findPatientIdentity(input: {
  mobile?: string;
  patientId?: string;
}): Promise<PatientIdentity | null> {
  const patientId = input.patientId?.trim() ?? "";
  const mobile = input.mobile?.trim() ?? "";
  let seed: PatientDocument | null = null;

  if (patientId) {
    if (isMongoObjectId(patientId)) {
      seed = await Patient.findById(patientId).exec();
    }
    if (!seed) {
      seed = await Patient.findOne({ patient_id: patientId }).sort({ created_at: 1 }).exec();
    }
  }

  if (!seed && mobile) {
    seed = await getLatestPatientByMobile(mobile);
  }

  if (!seed) {
    return null;
  }
  return loadIdentityFromSeed(seed);
}

/**
 * Lookup identities for the Register Patient search.
 * Mobile (or Patient ID) is primary and returns at most one identity.
 * Name-only search can return multiple distinct patients; callers must not auto-select.
 */
export async function searchPatientIdentities(input: {
  mobile?: string;
  patientId?: string;
  patientName?: string;
}): Promise<PatientIdentity[]> {
  const patientId = input.patientId?.trim() ?? "";
  const mobile = input.mobile?.trim() ?? "";
  const patientName = input.patientName?.trim() ?? "";

  if (patientId || mobile) {
    const identity = await findPatientIdentity({ mobile, patientId });
    if (!identity) {
      return [];
    }
    if (patientName && !identityMatchesName(identity, patientName)) {
      return [];
    }
    return [identity];
  }

  if (!patientName) {
    return [];
  }

  const visits = await Patient.find({
    patient_name: icontainsRegex(patientName),
  })
    .sort({ created_at: -1 })
    .exec();

  const seen = new Set<string>();
  const identities: PatientIdentity[] = [];
  for (const visit of visits) {
    const id = permanentPatientId(visit);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const identity = await loadIdentityFromSeed(visit);
    seen.add(identity.patientId);
    identities.push(identity);
  }
  return identities;
}

export async function resolveCreateIdentity(input: {
  mobile: string;
  patientId?: string;
}): Promise<{ patientId: string | null; visitNumber: number }> {
  const identity = await findPatientIdentity({
    mobile: input.mobile,
    ...(input.patientId ? { patientId: input.patientId } : {}),
  });
  if (!identity) {
    return { patientId: null, visitNumber: 1 };
  }
  return { patientId: identity.patientId, visitNumber: identity.visitCount + 1 };
}

export function newPatientObjectId(): Types.ObjectId {
  return new Types.ObjectId();
}

/** Visit document by `_id`, or the latest visit sharing that permanent `patient_id`. */
export async function findVisitByPublicId(pk: string): Promise<PatientDocument | null> {
  const id = pk.trim();
  if (!isMongoObjectId(id)) {
    return null;
  }
  const byId = await Patient.findById(id).exec();
  if (byId) {
    return byId;
  }
  return Patient.findOne({ patient_id: id }).sort({ created_at: -1 }).exec();
}
