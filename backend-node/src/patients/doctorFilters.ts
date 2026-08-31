import { PATIENT_STATUSES, PatientStatus } from "../constants";
import { createdAtUtcRangeFilter, getTodayUtcRange, isTruthyQueryFlag } from "../http/utc";
import { icontainsRegex, readQueryString } from "../http/validation";

export type DoctorListSort = {
  [field: string]: 1 | -1;
};

/**
 * Django `apply_doctor_filters` plus list ordering.
 * Default (no status, empty or waiting filter) is WAITING only.
 * `filter=today` does not apply the waiting default.
 */
export function buildDoctorListFilter(
  query: Record<string, unknown>,
  now: Date = new Date(),
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  const search = readQueryString(query["search"]);
  const statusFilter = readQueryString(query["status"]);
  const filterType = readQueryString(query["filter"]);
  const todayFlag = isTruthyQueryFlag(query["today"]);

  if (search) {
    const pattern = icontainsRegex(search);
    clauses.push({
      $or: [{ patient_name: pattern }, { mobile: pattern }, { token_number: pattern }],
    });
  }

  if (statusFilter === "active") {
    clauses.push({
      status: { $in: [PatientStatus.WAITING, PatientStatus.IN_CONSULTATION] },
    });
  } else if (statusFilter && (PATIENT_STATUSES as readonly string[]).includes(statusFilter)) {
    clauses.push({ status: statusFilter });
  } else if (!filterType || filterType === "waiting") {
    clauses.push({ status: PatientStatus.WAITING });
  }

  if (todayFlag || filterType === "today") {
    clauses.push(createdAtUtcRangeFilter(getTodayUtcRange(now)));
  } else if (filterType === "completed") {
    clauses.push({ status: PatientStatus.COMPLETED });
  }

  if (clauses.length === 0) {
    return {};
  }
  if (clauses.length === 1 && clauses[0]) {
    return clauses[0];
  }
  return { $and: clauses };
}

export function doctorListSort(statusFilter: string): DoctorListSort {
  if (statusFilter === PatientStatus.IN_CONSULTATION) {
    return { consultation_started_at: -1 };
  }
  if (statusFilter === PatientStatus.COMPLETED) {
    return { consultation_completed_at: -1 };
  }
  return { created_at: 1 };
}
