/**
 * Attendance helpers: canonical hashing, evidence payload, chain hash,
 * and record recalculation (compliance engine).
 */

import { createHash } from "crypto";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ==========================================
// CANONICAL JSON  (sort_keys, no spaces)
// ==========================================

function canonicalStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`);
    return "{" + pairs.join(",") + "}";
  }
  return "null";
}

export function hashPayload(payload: Record<string, unknown>): string {
  const canonical = canonicalStringify(payload);
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

// ==========================================
// EVIDENCE PAYLOAD
// ==========================================

export interface EvidenceInput {
  deviceLocalTime?: string;
  timezone?: string;
  timezoneOffsetMinutes?: number;
  geoLatitude?: number;
  geoLongitude?: number;
  geoAccuracyMeters?: number;
  deviceFingerprint?: string;
  signatureName?: string;
  signatureRut?: string;
  statementAccepted?: boolean;
  statementText?: string;
  notes?: string;
  photoBase64?: string;
}

const DEFAULT_DECLARATION_TEXT =
  "Declaro que la información registrada es verídica y que me encuentro en condiciones de realizar mis labores de manera segura.";

export function buildEvidencePayload(params: {
  rawRequest: any;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  eventAt: Date;
  policy: Record<string, unknown> | null;
  evidence: EvidenceInput;
  userId: string;
  userName: string;
}): Record<string, unknown> {
  const headers = params.rawRequest?.headers || {};
  const ip =
    headers["x-forwarded-for"] ||
    headers["x-real-ip"] ||
    params.rawRequest?.ip ||
    params.rawRequest?.connection?.remoteAddress ||
    "";

  const tz = params.evidence.timezone || (params.policy?.timezone as string) || "America/Santiago";
  const offsetMinutes = params.evidence.timezoneOffsetMinutes ?? 0;

  return {
    captured_at_utc: params.eventAt.toISOString(),
    captured_local_time: params.evidence.deviceLocalTime || "",
    timezone: tz,
    timezone_offset_minutes: offsetMinutes,
    ip_address: String(ip).split(",")[0].trim(),
    user_agent: String(headers["user-agent"] || ""),
    device_fingerprint: String(params.evidence.deviceFingerprint || "").trim(),
    geo_latitude: params.evidence.geoLatitude ?? null,
    geo_longitude: params.evidence.geoLongitude ?? null,
    geo_accuracy_meters: params.evidence.geoAccuracyMeters ?? null,
    signature_name: String(params.evidence.signatureName || "").trim(),
    signature_rut: String(params.evidence.signatureRut || "").trim(),
    statement_accepted: !!params.evidence.statementAccepted,
    statement_text:
      params.evidence.statementText ||
      (params.policy?.declarationText as string) ||
      DEFAULT_DECLARATION_TEXT,
    employee_id: params.employeeId,
    employee_name: params.employeeName,
    employee_code: params.employeeCode,
    user_id: params.userId || null,
    user_name: params.userName || null,
    notes: String(params.evidence.notes || "").trim(),
    legal_basis: (params.policy?.legalBasis as string) || "Código del Trabajo, Ley 16.744",
  };
}

// ==========================================
// CHAIN HASH
// ==========================================

export function calculateChainHash(params: {
  recordId: string;
  eventType: string;
  eventAt: string;
  payloadHash: string;
  previousHash: string;
}): string {
  return hashPayload({
    record_id: params.recordId,
    event_type: params.eventType,
    event_at: params.eventAt,
    payload_hash: params.payloadHash,
    previous_hash: params.previousHash,
  });
}

// ==========================================
// RECALCULATE ATTENDANCE RECORD
// ==========================================

export async function recalculateAttendanceRecord(
  companyId: string,
  employeeId: string,
  date: string
): Promise<{ flags: string[]; status: string }> {
  const cref = companyRef(companyId);

  const [eventsSnap, recordSnap] = await Promise.all([
    cref
      .collection("attendanceEvents")
      .where("employeeId", "==", employeeId)
      .where("date", "==", date)
      .orderBy("timestamp")
      .get(),
    cref
      .collection("attendanceRecords")
      .where("employeeId", "==", employeeId)
      .where("date", "==", date)
      .limit(1)
      .get(),
  ]);

  const events = eventsSnap.docs.map((d) => d.data());
  if (events.length === 0) return { flags: [], status: "absent" };

  // Find policy
  const policySnap = await cref
    .collection("attendancePolicies")
    .where("isActive", "==", true)
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  const policy = policySnap.empty ? null : policySnap.docs[0].data();

  const workHoursStart = (policy?.workHoursStart as string) || "09:00";
  const workHoursEnd = (policy?.workHoursEnd as string) || "18:00";
  const lunchBreakMinutes = (policy?.lunchBreakMinutes as number) ?? 30;
  const toleranceLate = (policy?.toleranceMinutesLate as number) ?? 0;
  const toleranceEarly = (policy?.toleranceMinutesEarly as number) ?? 0;
  const standardDailyMinutes = (policy?.standardDailyMinutes as number) ?? 540;
  const minBreakMinutes = (policy?.minBreakMinutes as number) ?? lunchBreakMinutes;

  let workedMinutes = 0;
  let breakMinutes = 0;
  let currentEntry: Date | null = null;
  let currentBreakStart: Date | null = null;
  let firstEntry: Date | null = null;
  let lastExit: Date | null = null;

  for (const ev of events) {
    const ts = new Date(ev.timestamp as string);
    const type = (ev.eventType as string) || "";

    if (type === "entry" || type === "check_in") {
      currentEntry = ts;
      if (!firstEntry) firstEntry = ts;
    } else if (type === "break_start") {
      if (currentEntry) {
        workedMinutes += Math.floor((ts.getTime() - currentEntry.getTime()) / 60000);
        currentEntry = null;
      }
      currentBreakStart = ts;
    } else if (type === "break_end") {
      if (currentBreakStart) {
        breakMinutes += Math.floor((ts.getTime() - currentBreakStart.getTime()) / 60000);
        currentBreakStart = null;
      }
      currentEntry = ts;
    } else if (type === "exit" || type === "check_out") {
      if (currentEntry) {
        workedMinutes += Math.floor((ts.getTime() - currentEntry.getTime()) / 60000);
        currentEntry = null;
      }
      lastExit = ts;
    }
  }

  // Late minutes
  let lateMinutes = 0;
  if (firstEntry && policy) {
    const [refHour, refMin] = workHoursStart.split(":").map(Number);
    const refTime = new Date(firstEntry);
    refTime.setHours(refHour, refMin, 0, 0);
    const diff = Math.floor((firstEntry.getTime() - refTime.getTime()) / 60000);
    lateMinutes = Math.max(0, diff - toleranceLate);
  }

  // Early exit minutes
  let earlyExitMinutes = 0;
  if (lastExit && policy) {
    const [endHour, endMin] = workHoursEnd.split(":").map(Number);
    const endTime = new Date(lastExit);
    endTime.setHours(endHour, endMin, 0, 0);
    const diff = Math.floor((endTime.getTime() - lastExit.getTime()) / 60000);
    earlyExitMinutes = Math.max(0, diff - toleranceEarly);
  }

  // Overtime
  const overtimeMinutes = Math.max(0, workedMinutes - standardDailyMinutes);

  // Flags
  const flags: string[] = [];
  if (lateMinutes > 0) flags.push("late_arrival");
  if (breakMinutes < minBreakMinutes && workedMinutes >= 300) flags.push("break_below_policy");
  if (earlyExitMinutes > 0) flags.push("early_exit");
  if (overtimeMinutes > 0) flags.push("overtime");
  if (!lastExit) flags.push("missing_exit");
  if (currentEntry && !lastExit) flags.push("open_shift_without_exit");
  if (currentBreakStart) flags.push("open_break_without_resume");

  // Status
  let status = "present";
  if (lateMinutes > 0) status = "late";
  else if (earlyExitMinutes > 0) status = "early_leave";

  const now = new Date().toISOString();
  const recordData: Record<string, unknown> = {
    workMinutes: workedMinutes,
    breakMinutes,
    lateMinutes,
    overtimeMinutes,
    earlyExitMinutes,
    flags,
    status,
    updatedAt: now,
  };

  if (!recordSnap.empty) {
    const existing = recordSnap.docs[0].data();
    // preserve checkIn/checkOut if already set from legacy events
    if (!existing.checkIn && firstEntry) recordData.checkIn = firstEntry.toISOString();
    if (!existing.checkOut && lastExit) recordData.checkOut = lastExit.toISOString();
    await recordSnap.docs[0].ref.update(recordData);
  } else {
    const ref = cref.collection("attendanceRecords").doc();
    await ref.set({
      companyId,
      employeeId,
      employeeName: (events[0].employeeName as string) || "",
      date,
      checkIn: firstEntry ? firstEntry.toISOString() : "",
      checkOut: lastExit ? lastExit.toISOString() : "",
      ...recordData,
      createdAt: now,
    });
  }

  return { flags, status };
}
