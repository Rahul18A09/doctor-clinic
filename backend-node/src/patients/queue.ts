import { PatientStatus } from "../constants";
import { getTodayUtcRange } from "../http/utc";
import { Patient } from "../models/patient.model";
import { formatTokenForDisplay } from "./tokens";

export type PublicQueueStatus = {
  todays_token: string;
  current_token: string;
  current_patient_name: string;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

/** Asia/Kolkata calendar day as UTC [start, end). */
function getIstDayRange(now: Date): { start: Date; end: Date } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const start = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

async function findCurrentInRange(todayFilter: Record<string, unknown>) {
  let current = await Patient.findOne({
    ...todayFilter,
    status: PatientStatus.IN_CONSULTATION,
  })
    .sort({ consultation_started_at: 1, created_at: 1 })
    .exec();

  if (!current) {
    current = await Patient.findOne({
      ...todayFilter,
      status: PatientStatus.WAITING,
    })
      .sort({ created_at: 1 })
      .exec();
  }

  return current;
}

/**
 * Public live queue.
 * Tests pass an explicit `now` and keep the UTC day window.
 * The live route uses the IST clinic day, then falls back to any active patient
 * so waiting / in-consultation tokens still show if they were registered earlier.
 */
export async function getPublicQueueStatus(
  now: Date = new Date(),
): Promise<PublicQueueStatus> {
  const isLiveRequest = arguments.length === 0;
  const { start, end } = isLiveRequest ? getIstDayRange(now) : getTodayUtcRange(now);
  const todayFilter = { created_at: { $gte: start, $lt: end } };

  const latestToday = await Patient.findOne(todayFilter).sort({ created_at: -1 }).exec();
  let current = await findCurrentInRange(todayFilter);

  if (!current && isLiveRequest) {
    current = await Patient.findOne({ status: PatientStatus.IN_CONSULTATION })
      .sort({ consultation_started_at: 1, created_at: 1 })
      .exec();
    if (!current) {
      current = await Patient.findOne({ status: PatientStatus.WAITING })
        .sort({ created_at: 1 })
        .exec();
    }
  }

  return {
    todays_token: latestToday ? formatTokenForDisplay(latestToday.token_number) : "",
    current_token: current ? formatTokenForDisplay(current.token_number) : "",
    current_patient_name: current ? current.patient_name : "",
  };
}
