import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { InvalidPaginationError } from "../http/errors";
import { parsePagination } from "../http/pagination";
import { successResponse, validationErrorResponse } from "../http/responses";
import { authenticate } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/authorize";
import { buildReports, listReportVisitsForExport } from "../reports/buildReports";
import { toCsv } from "../reports/csv";
import { CSV_MAX_ROWS, formatUtcYmd, parseReportsQuery } from "../reports/dateRange";

function csvDate(value: string | null): string {
  if (!value) return "";
  const iso = value.endsWith("Z") ? value : `${value}Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatUtcYmd(parsed);
}

function filenameForRange(startDate: string, endDate: string): string {
  return `clinic-reports-${startDate}-to-${endDate}.csv`;
}


const getReports: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parseReportsQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors, "Invalid report filters.");
    return;
  }

  let pagination;
  try {
    pagination = parsePagination(req.query);
  } catch (error) {
    if (error instanceof InvalidPaginationError) {
      validationErrorResponse(res, { page: [error.message] }, error.message);
      return;
    }
    throw error;
  }

  const data = await buildReports(parsed.value, pagination);
  successResponse(res, {
    message: "Reports retrieved successfully.",
    data,
  });
};

const exportReports: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = parseReportsQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    validationErrorResponse(res, parsed.errors, "Invalid report filters.");
    return;
  }

  const rows = await listReportVisitsForExport(parsed.value, CSV_MAX_ROWS);
  const csv = toCsv(
    [
      "Date",
      "Patient",
      "Patient ID",
      "Token",
      "Visit",
      "Status",
      "Registered By",
    ],
    rows.map((row) => [
      row.created_at ? csvDate(row.created_at) : "",
      row.patient_name,
      row.patient_id,
      row.token_number,
      row.visit_number,
      row.status,
      row.created_by_name,
    ]),
  );

  const filename = filenameForRange(
    parsed.value.current.startDate,
    parsed.value.current.endDate,
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};

const reportsRouter = Router();

reportsRouter.get("/", authenticate, requireAdmin, getReports);
reportsRouter.get("", authenticate, requireAdmin, getReports);
reportsRouter.get("/export/", authenticate, requireAdmin, exportReports);
reportsRouter.get("/export", authenticate, requireAdmin, exportReports);

export default reportsRouter;
