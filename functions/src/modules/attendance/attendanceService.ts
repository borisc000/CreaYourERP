/**
 * Cloud Functions para Asistencia (Attendance)
 * - saveAttendancePolicy: Crea/actualiza política de asistencia
 * - registerPunch: Registro genérico (entry/break_start/break_end/exit) con hash chain y evidencia
 * - registerCheckIn / registerCheckOut: Wrappers backward-compatible de registerPunch
 * - getAttendanceRecords: Consulta registros filtrados
 * - approveAttendanceRecord: Aprueba un registro manualmente
 * - getAttendanceComplianceReport: Reporte de compliance por rango
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  buildEvidencePayload,
  calculateChainHash,
  hashPayload,
  recalculateAttendanceRecord,
  type EvidenceInput,
} from "./attendanceHelpers";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// saveAttendancePolicy
// ==========================================

interface SaveAttendancePolicyPayload {
  id?: string;
  name: string;
  workDays: string[];
  workHoursStart: string;
  workHoursEnd: string;
  lunchBreakMinutes: number;
  toleranceMinutesEarly: number;
  toleranceMinutesLate: number;
  overtimeThresholdMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}

export const saveAttendancePolicy = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.manage_policies", { companyId });

    const payload = request.data as SaveAttendancePolicyPayload;
    if (!payload.name?.trim()) throw new HttpsError("invalid-argument", "El nombre de la política es requerido");

    try {
      const now = nowIso();
      const policiesCol = companyRef(companyId).collection("attendancePolicies");

      if (payload.isDefault) {
        const existing = await policiesCol.where("isDefault", "==", true).get();
        const batch = db.batch();
        existing.docs.forEach((doc) => batch.update(doc.ref, { isDefault: false, updatedAt: now }));
        await batch.commit();
      }

      if (payload.id) {
        await policiesCol.doc(payload.id).update({
          name: payload.name.trim(),
          workDays: payload.workDays,
          workHoursStart: payload.workHoursStart,
          workHoursEnd: payload.workHoursEnd,
          lunchBreakMinutes: payload.lunchBreakMinutes ?? 30,
          toleranceMinutesEarly: payload.toleranceMinutesEarly ?? 0,
          toleranceMinutesLate: payload.toleranceMinutesLate ?? 0,
          overtimeThresholdMinutes: payload.overtimeThresholdMinutes ?? 0,
          isDefault: payload.isDefault,
          isActive: payload.isActive ?? true,
          updatedAt: now,
        });
        return { success: true, id: payload.id };
      } else {
        const ref = policiesCol.doc();
        await ref.set({
          companyId,
          name: payload.name.trim(),
          workDays: payload.workDays,
          workHoursStart: payload.workHoursStart,
          workHoursEnd: payload.workHoursEnd,
          lunchBreakMinutes: payload.lunchBreakMinutes ?? 30,
          toleranceMinutesEarly: payload.toleranceMinutesEarly ?? 0,
          toleranceMinutesLate: payload.toleranceMinutesLate ?? 0,
          overtimeThresholdMinutes: payload.overtimeThresholdMinutes ?? 0,
          isDefault: payload.isDefault,
          isActive: payload.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, id: ref.id };
      }
    } catch (error: any) {
      console.error("[saveAttendancePolicy] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar política");
    }
  }
);

// ==========================================
// registerPunch (core)
// ==========================================

interface RegisterPunchPayload {
  employeeId: string;
  eventType: "entry" | "break_start" | "break_end" | "exit";
  eventAt?: string;
  evidence?: EvidenceInput;
}

async function executePunch(
  request: any,
  payload: RegisterPunchPayload
): Promise<{
  success: boolean;
  eventId: string;
  recordId: string;
  chainHash: string;
  flags: string[];
  status: string;
}> {
  const companyId = request.auth.token.companyId as string;
  const { employeeId, eventType, eventAt, evidence = {} } = payload;

  if (!employeeId) throw new HttpsError("invalid-argument", "employeeId es requerido");
  if (!eventType) throw new HttpsError("invalid-argument", "eventType es requerido");

  const now = new Date();
  const evAt = eventAt ? new Date(eventAt) : now;
  const evIso = evAt.toISOString();
  const date = evIso.split("T")[0];

  // Read employee
  const empSnap = await companyRef(companyId).collection("employees").doc(employeeId).get();
  if (!empSnap.exists) throw new HttpsError("not-found", "Empleado no encontrado");
  const emp = empSnap.data() || {};
  const employeeName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || (emp.name as string) || "";
  const employeeCode = (emp.employeeCode as string) || "";

  // Read default policy
  const policiesSnap = await companyRef(companyId)
    .collection("attendancePolicies")
    .where("isActive", "==", true)
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  const policy = policiesSnap.empty ? null : policiesSnap.docs[0].data();

  // Build evidence payload
  const rawRequest = (request as any).rawRequest || {};
  const userId = request.auth?.uid || "";
  const userName = (request.auth?.token?.name as string) || (request.auth?.token?.email as string) || "";

  const evidencePayload = buildEvidencePayload({
    rawRequest,
    employeeId,
    employeeName,
    employeeCode,
    eventAt: evAt,
    policy,
    evidence,
    userId,
    userName,
  });

  const payloadHash = hashPayload(evidencePayload);

  // Previous hash from last event of this employee
  const lastEventSnap = await companyRef(companyId)
    .collection("attendanceEvents")
    .where("employeeId", "==", employeeId)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  const previousHash = lastEventSnap.empty ? "" : (lastEventSnap.docs[0].data().chainHash as string) || "";

  // Find or create record for the date
  const recordsSnap = await companyRef(companyId)
    .collection("attendanceRecords")
    .where("employeeId", "==", employeeId)
    .where("date", "==", date)
    .limit(1)
    .get();

  let recordId: string;
  if (recordsSnap.empty) {
    recordId = companyRef(companyId).collection("attendanceRecords").doc().id;
    await companyRef(companyId).collection("attendanceRecords").doc(recordId).set({
      companyId,
      employeeId,
      employeeName,
      date,
      checkIn: "",
      checkOut: "",
      checkInLocation: "",
      checkOutLocation: "",
      checkInPhoto: "",
      checkOutPhoto: "",
      workMinutes: 0,
      overtimeMinutes: 0,
      lunchMinutes: policy?.lunchBreakMinutes ?? 30,
      status: "present",
      flags: [],
      notes: evidence.notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  } else {
    recordId = recordsSnap.docs[0].id;
  }

  const chainHash = calculateChainHash({
    recordId,
    eventType,
    eventAt: evIso,
    payloadHash,
    previousHash,
  });

  // Save event
  const eventRef = companyRef(companyId).collection("attendanceEvents").doc();
  await eventRef.set({
    companyId,
    employeeId,
    employeeName,
    eventType,
    timestamp: evIso,
    date,
    latitude: evidence.geoLatitude ?? null,
    longitude: evidence.geoLongitude ?? null,
    photoUrl: evidence.photoBase64 || "",
    notes: evidence.notes || "",
    createdBy: request.auth?.uid || "",
    createdAt: nowIso(),
    evidencePayload,
    payloadHash,
    previousHash,
    chainHash,
  });

  // Update record checkIn/checkOut for backward compatibility
  const recordRef = companyRef(companyId).collection("attendanceRecords").doc(recordId);
  const recordUpdates: Record<string, unknown> = { updatedAt: nowIso() };
  if (eventType === "entry") {
    recordUpdates.checkIn = evIso;
    if (evidence.geoLatitude && evidence.geoLongitude) {
      recordUpdates.checkInLocation = `${evidence.geoLatitude},${evidence.geoLongitude}`;
    }
    if (evidence.photoBase64) recordUpdates.checkInPhoto = evidence.photoBase64;
  }
  if (eventType === "exit") {
    recordUpdates.checkOut = evIso;
    if (evidence.geoLatitude && evidence.geoLongitude) {
      recordUpdates.checkOutLocation = `${evidence.geoLatitude},${evidence.geoLongitude}`;
    }
    if (evidence.photoBase64) recordUpdates.checkOutPhoto = evidence.photoBase64;
  }
  await recordRef.update(recordUpdates);

  // Recalculate
  const { flags, status } = await recalculateAttendanceRecord(companyId, employeeId, date);

  return { success: true, eventId: eventRef.id, recordId, chainHash, flags, status };
}

export const registerPunch = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.register_check", { companyId });

    try {
      return await executePunch(request, request.data as RegisterPunchPayload);
    } catch (error: any) {
      console.error("[registerPunch] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al registrar marcación");
    }
  }
);

// ==========================================
// registerCheckIn (backward-compatible wrapper)
// ==========================================

interface RegisterCheckInPayload {
  employeeId: string;
  employeeName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  notes?: string;
}

export const registerCheckIn = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.register_check", { companyId });

    const { employeeId, latitude, longitude, photoUrl, notes } = request.data as RegisterCheckInPayload;
    try {
      const result = await executePunch(request, {
        employeeId,
        eventType: "entry",
        evidence: {
          geoLatitude: latitude,
          geoLongitude: longitude,
          photoBase64: photoUrl,
          notes,
        },
      });
      return { success: true, eventId: result.eventId, recordId: result.recordId, status: result.status };
    } catch (error: any) {
      console.error("[registerCheckIn] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al registrar entrada");
    }
  }
);

// ==========================================
// registerCheckOut (backward-compatible wrapper)
// ==========================================

interface RegisterCheckOutPayload {
  employeeId: string;
  employeeName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  notes?: string;
}

export const registerCheckOut = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.register_check", { companyId });

    const { employeeId, latitude, longitude, photoUrl, notes } = request.data as RegisterCheckOutPayload;
    try {
      const result = await executePunch(request, {
        employeeId,
        eventType: "exit",
        evidence: {
          geoLatitude: latitude,
          geoLongitude: longitude,
          photoBase64: photoUrl,
          notes,
        },
      });
      return {
        success: true,
        eventId: result.eventId,
        recordId: result.recordId,
        workMinutes: 0, // recalculated async by trigger
        overtimeMinutes: 0,
        status: result.status,
      };
    } catch (error: any) {
      console.error("[registerCheckOut] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al registrar salida");
    }
  }
);

// ==========================================
// getAttendanceRecords
// ==========================================

interface GetAttendanceRecordsPayload {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const getAttendanceRecords = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view_records", { companyId });

    const { employeeId, startDate, endDate, limit = 100 } = request.data as GetAttendanceRecordsPayload;

    try {
      let q = companyRef(companyId).collection("attendanceRecords").orderBy("date", "desc");
      if (employeeId) q = q.where("employeeId", "==", employeeId);
      if (startDate) q = q.where("date", ">=", startDate);
      if (endDate) q = q.where("date", "<=", endDate);
      q = q.limit(limit);

      const snap = await q.get();
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
      return { success: true, records };
    } catch (error: any) {
      console.error("[getAttendanceRecords] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener registros");
    }
  }
);

// ==========================================
// approveAttendanceRecord
// ==========================================

interface ApproveAttendanceRecordPayload {
  recordId: string;
  notes?: string;
}

export const approveAttendanceRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.approve_records", { companyId });

    const { recordId, notes } = request.data as ApproveAttendanceRecordPayload;
    if (!recordId) throw new HttpsError("invalid-argument", "recordId es requerido");

    try {
      const now = nowIso();
      const ref = companyRef(companyId).collection("attendanceRecords").doc(recordId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Registro no encontrado");

      await ref.update({
        approvedBy: request.auth.uid,
        approvedAt: now,
        notes: notes || snap.data()?.notes || "",
        updatedAt: now,
      });
      return { success: true };
    } catch (error: any) {
      console.error("[approveAttendanceRecord] Error:", error);
      throw new HttpsError("internal", error.message || "Error al aprobar registro");
    }
  }
);

// ==========================================
// getAttendanceComplianceReport
// ==========================================

interface ComplianceReportPayload {
  startDate: string;
  endDate: string;
  employeeId?: string;
}

export const getAttendanceComplianceReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.compliance_report", { companyId });

    const { startDate, endDate, employeeId } = request.data as ComplianceReportPayload;
    if (!startDate || !endDate) throw new HttpsError("invalid-argument", "startDate y endDate son requeridos");

    try {
      let q = companyRef(companyId)
        .collection("attendanceRecords")
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "desc");

      if (employeeId) q = q.where("employeeId", "==", employeeId);
      q = q.limit(1000);

      const snap = await q.get();
      const records: Record<string, unknown>[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const summary: Record<
        string,
        {
          employeeId: string;
          employeeName: string;
          daysWorked: number;
          daysWithFlags: number;
          totalLateMinutes: number;
          totalOvertimeMinutes: number;
          flagsBreakdown: Record<string, number>;
        }
      > = {};

      for (const r of records) {
        const eid = (r.employeeId as string) || "unknown";
        if (!summary[eid]) {
          summary[eid] = {
            employeeId: eid,
            employeeName: (r.employeeName as string) || "Sin nombre",
            daysWorked: 0,
            daysWithFlags: 0,
            totalLateMinutes: 0,
            totalOvertimeMinutes: 0,
            flagsBreakdown: {},
          };
        }
        summary[eid].daysWorked += 1;
        const flags = (r.flags as string[]) || [];
        if (flags.length > 0) summary[eid].daysWithFlags += 1;
        summary[eid].totalLateMinutes += (r.lateMinutes as number) || 0;
        summary[eid].totalOvertimeMinutes += (r.overtimeMinutes as number) || 0;
        for (const f of flags) {
          summary[eid].flagsBreakdown[f] = (summary[eid].flagsBreakdown[f] || 0) + 1;
        }
      }

      const flaggedRecords = records.filter((r) => ((r.flags as string[]) || []).length > 0);

      return {
        success: true,
        summary: Object.values(summary),
        flaggedRecords,
        totalRecords: records.length,
      };
    } catch (error: any) {
      console.error("[getAttendanceComplianceReport] Error:", error);
      throw new HttpsError("internal", error.message || "Error al generar reporte");
    }
  }
);
