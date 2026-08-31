import { PatientStatus } from "../constants";
import { getTodayUtcRange } from "../http/utc";
import { Patient } from "../models/patient.model";

/** Django `get_patient_stats()` — five separate counts, UTC today window. */
export async function getPatientStats(now: Date = new Date()): Promise<{
  waiting: number;
  in_consultation: number;
  completed: number;
  completed_today: number;
  today: number;
}> {
  const { start, end } = getTodayUtcRange(now);
  const [waiting, in_consultation, completed, completed_today, today] = await Promise.all([
    Patient.countDocuments({ status: PatientStatus.WAITING }).exec(),
    Patient.countDocuments({ status: PatientStatus.IN_CONSULTATION }).exec(),
    Patient.countDocuments({ status: PatientStatus.COMPLETED }).exec(),
    Patient.countDocuments({
      status: PatientStatus.COMPLETED,
      consultation_completed_at: { $gte: start, $lt: end },
    }).exec(),
    Patient.countDocuments({
      created_at: { $gte: start, $lt: end },
    }).exec(),
  ]);
  return { waiting, in_consultation, completed, completed_today, today };
}
