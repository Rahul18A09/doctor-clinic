import { PATIENT_STATUSES, PatientStatus } from "../constants";
import {
  createdAtUtcRangeFilter,
  getTodayUtcRange,
  parseUtcDateParam,
} from "../http/utc";
import { icontainsRegex, readQueryString } from "../http/validation";

export function buildPatientListFilter(
  query: Record<string, unknown>,
  now: Date = new Date(),
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  const search = readQueryString(query["search"]);
  const statusFilter = readQueryString(query["status"]);
  const filterType = readQueryString(query["filter"]);
  const dateParam = readQueryString(query["date"]);

  if (search) {
    const pattern = icontainsRegex(search);
    clauses.push({
      $or: [
        { patient_name: pattern },
        { mobile: pattern },
        { token_number: pattern },
        { patient_id: pattern },
      ],
    });
  }

  if (statusFilter && (PATIENT_STATUSES as readonly string[]).includes(statusFilter)) {
    clauses.push({ status: statusFilter });
  } else if (filterType === "waiting") {
    clauses.push({ status: PatientStatus.WAITING });
  } else if (filterType === "completed") {
    clauses.push({ status: PatientStatus.COMPLETED });
  }

  if (dateParam) {
    const range = parseUtcDateParam(dateParam);
    if (range) {
      clauses.push(createdAtUtcRangeFilter(range));
    }
  } else if (filterType === "today") {
    clauses.push(createdAtUtcRangeFilter(getTodayUtcRange(now)));
  }

  if (clauses.length === 0) {
    return {};
  }
  if (clauses.length === 1 && clauses[0]) {
    return clauses[0];
  }
  return { $and: clauses };
}
