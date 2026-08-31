import { PatientStatus } from "../constants";
import { toDjangoIso } from "../auth/iso";
import { buildPaginationMeta, type ParsedPagination } from "../http/pagination";
import { Patient } from "../models/patient.model";
import { formatTokenForDisplay } from "../patients/tokens";
import { permanentPatientId } from "../patients/visits";
import {
  bucketDailyComparison,
  eachUtcDate,
  percentChange,
  type ParsedReportsQuery,
  type ReportsRange,
} from "./dateRange";

function createdAtFilter(range: ReportsRange): { created_at: { $gte: Date; $lt: Date } } {
  return { created_at: { $gte: range.start, $lt: range.end } };
}

function uniqueIdentityExpr() {
  return {
    $cond: [
      { $gt: [{ $strLenCP: { $ifNull: ["$patient_id", ""] } }, 0] },
      "$patient_id",
      { $concat: ["m:", { $ifNull: ["$mobile", ""] }] },
    ],
  };
}

async function countUniquePatients(range: ReportsRange): Promise<number> {
  const rows = await Patient.aggregate<{ count: number }>([
    { $match: createdAtFilter(range) },
    { $group: { _id: uniqueIdentityExpr() } },
    { $count: "count" },
  ]).exec();
  return rows[0]?.count ?? 0;
}

async function countByStatus(range: ReportsRange): Promise<Record<string, number>> {
  const rows = await Patient.aggregate<{ _id: string; count: number }>([
    { $match: createdAtFilter(range) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).exec();
  const counts: Record<string, number> = {
    [PatientStatus.WAITING]: 0,
    [PatientStatus.IN_CONSULTATION]: 0,
    [PatientStatus.COMPLETED]: 0,
    [PatientStatus.CANCELLED]: 0,
  };
  for (const row of rows) {
    if (row._id) counts[row._id] = row.count;
  }
  return counts;
}

async function visitsByDay(range: ReportsRange): Promise<Map<string, number>> {
  const rows = await Patient.aggregate<{ _id: string; count: number }>([
    { $match: createdAtFilter(range) },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "UTC" },
        },
        count: { $sum: 1 },
      },
    },
  ]).exec();
  return new Map(rows.map((row) => [row._id, row.count]));
}

async function averageWaitMinutes(range: ReportsRange): Promise<number | null> {
  const rows = await Patient.aggregate<{ avg: number }>([
    {
      $match: {
        ...createdAtFilter(range),
        consultation_started_at: { $exists: true, $ne: null },
      },
    },
    {
      $project: {
        waitMs: { $subtract: ["$consultation_started_at", "$created_at"] },
      },
    },
    {
      $match: {
        waitMs: { $gte: 0, $lte: 24 * 60 * 60 * 1000 },
      },
    },
    {
      $group: { _id: null, avg: { $avg: "$waitMs" } },
    },
  ]).exec();
  const avg = rows[0]?.avg;
  if (avg == null || Number.isNaN(avg)) return null;
  return Math.round(avg / 60_000);
}

async function receptionistStats(range: ReportsRange) {
  const rows = await Patient.aggregate<{
    _id: string;
    full_name: string;
    visits_created: number;
    patients: string[];
  }>([
    { $match: createdAtFilter(range) },
    {
      $group: {
        _id: { $ifNull: ["$created_by", ""] },
        full_name: { $first: { $ifNull: ["$created_by_name", "Unknown"] } },
        visits_created: { $sum: 1 },
        patients: { $addToSet: uniqueIdentityExpr() },
      },
    },
    { $sort: { visits_created: -1, full_name: 1 } },
    { $limit: 50 },
  ]).exec();

  return rows.map((row) => ({
    id: row._id || null,
    full_name: row.full_name || "Unknown",
    patients_registered: row.patients.filter(Boolean).length,
    visits_created: row.visits_created,
  }));
}

function kpi(value: number, previous: number) {
  return {
    value,
    previous,
    change_percent: percentChange(value, previous),
  };
}

function visitsFilter(query: ParsedReportsQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = createdAtFilter(query.current);
  if (query.status) {
    filter.status = query.status;
  } else if (query.table === "consultations") {
    filter.status = {
      $in: [PatientStatus.COMPLETED, PatientStatus.IN_CONSULTATION],
    };
  }
  return filter;
}

export type ReportVisitRow = {
  id: string;
  created_at: string | null;
  patient_name: string;
  patient_id: string;
  token_number: string;
  visit_number: number;
  status: string;
  created_by_name: string;
  chief_complaint: string;
  diagnosis: string;
  consulted_by_name: string;
  consultation_started_at: string | null;
  consultation_completed_at: string | null;
};

function serializeVisit(patient: {
  _id?: { toString(): string };
  id?: string;
  created_at?: Date | null;
  patient_name: string;
  patient_id?: string | null;
  token_number?: string | null;
  visit_number?: number | null;
  status: string;
  created_by_name?: string | null;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  consulted_by_name?: string | null;
  consultation_started_at?: Date | null;
  consultation_completed_at?: Date | null;
  completed_at?: Date | null;
}): ReportVisitRow {
  return {
    id: patient.id ?? String(patient._id),
    created_at: toDjangoIso(patient.created_at),
    patient_name: patient.patient_name,
    patient_id: permanentPatientId(patient),
    token_number: formatTokenForDisplay(patient.token_number),
    visit_number: patient.visit_number || 1,
    status: patient.status,
    created_by_name: patient.created_by_name || "",
    chief_complaint: patient.chief_complaint || "",
    diagnosis: patient.diagnosis || "",
    consulted_by_name: patient.consulted_by_name || "",
    consultation_started_at: toDjangoIso(patient.consultation_started_at),
    consultation_completed_at: toDjangoIso(
      patient.consultation_completed_at || patient.completed_at,
    ),
  };
}

export async function buildReports(query: ParsedReportsQuery, pagination: ParsedPagination) {
  const { current, previous } = query;

  const [
    currentTotal,
    previousTotal,
    currentUnique,
    previousUnique,
    currentStatus,
    previousStatus,
    currentDays,
    previousDays,
    averageWaitingMinutes,
    receptionists,
    visitTotal,
    visitDocs,
  ] = await Promise.all([
    Patient.countDocuments(createdAtFilter(current)).exec(),
    Patient.countDocuments(createdAtFilter(previous)).exec(),
    countUniquePatients(current),
    countUniquePatients(previous),
    countByStatus(current),
    countByStatus(previous),
    visitsByDay(current),
    visitsByDay(previous),
    averageWaitMinutes(current),
    receptionistStats(current),
    Patient.countDocuments(visitsFilter(query)).exec(),
    Patient.find(visitsFilter(query))
      .sort({ created_at: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .exec(),
  ]);

  const currentCompleted = currentStatus[PatientStatus.COMPLETED] ?? 0;
  const previousCompleted = previousStatus[PatientStatus.COMPLETED] ?? 0;
  const currentCancelled = currentStatus[PatientStatus.CANCELLED] ?? 0;
  const previousCancelled = previousStatus[PatientStatus.CANCELLED] ?? 0;
  const currentWaiting = currentStatus[PatientStatus.WAITING] ?? 0;
  const currentInConsultation = currentStatus[PatientStatus.IN_CONSULTATION] ?? 0;

  const visitsTrend = eachUtcDate(current.start, current.end).map((date) => ({
    date,
    visits: currentDays.get(date) ?? 0,
  }));

  const previousDates = eachUtcDate(previous.start, previous.end);
  const currentDates = eachUtcDate(current.start, current.end);
  const dailyComparison = bucketDailyComparison(
    currentDates.map((date, index) => {
      const previousDate = previousDates[index] ?? "";
      return {
        date,
        previous_date: previousDate,
        this_period: currentDays.get(date) ?? 0,
        previous_period: previousDate ? (previousDays.get(previousDate) ?? 0) : 0,
      };
    }),
  );

  return {
    range: {
      start_date: current.startDate,
      end_date: current.endDate,
      previous_start_date: previous.startDate,
      previous_end_date: previous.endDate,
      day_count: current.dayCount,
    },
    kpis: {
      total_visits: kpi(currentTotal, previousTotal),
      unique_patients: kpi(currentUnique, previousUnique),
      consultations: kpi(currentCompleted, previousCompleted),
      cancelled_visits: kpi(currentCancelled, previousCancelled),
    },
    visits_trend: visitsTrend,
    consultation_status: {
      completed: currentCompleted,
      cancelled: currentCancelled,
      waiting: currentWaiting,
      in_consultation: currentInConsultation,
      total: currentTotal,
    },
    visits: {
      results: visitDocs.map(serializeVisit),
      pagination: buildPaginationMeta(pagination, visitTotal),
    },
    queue: {
      total_tokens: currentTotal,
      completed_tokens: currentCompleted,
      cancelled_tokens: currentCancelled,
      waiting_tokens: currentWaiting,
      in_consultation_tokens: currentInConsultation,
      average_waiting_minutes: averageWaitingMinutes,
    },
    receptionists,
    daily_comparison: dailyComparison,
  };
}

export async function listReportVisitsForExport(
  query: ParsedReportsQuery,
  limit: number,
): Promise<ReportVisitRow[]> {
  const docs = await Patient.find(visitsFilter(query))
    .sort({ created_at: -1 })
    .limit(limit)
    .exec();
  return docs.map(serializeVisit);
}
