/**
 * Cloud Functions para Asistencia (Attendance)
 * - saveAttendancePolicy: Crea/actualiza política de asistencia
 * - registerCheckIn: Registra entrada y crea/actualiza registro del día
 * - registerCheckOut: Registra salida y calcula minutos trabajados/extras
 * - getAttendanceRecords: Consulta registros filtrados
 * - approveAttendanceRecord: Aprueba un registro manualmente
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ---------- saveAttendancePolicy ----------
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
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as SaveAttendancePolicyPayload;
    if (!payload.name?.trim()) {
      throw new HttpsError("invalid-argument", "El nombre de la política es requerido");
    }

    try {
      const now = new Date().toISOString();
      const policiesCol = companyRef(companyId).collection("attendancePolicies");

      if (payload.isDefault) {
        const existing = await policiesCol.where("isDefault", "==", true).get();
        const batch = db.batch();
        existing.docs.forEach((doc) => {
          batch.update(doc.ref, { isDefault: false, updatedAt: now });
        });
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

// ---------- registerCheckIn ----------
interface RegisterCheckInPayload {
  employeeId: string;
  employeeName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  notes?: string;
}

type AttendanceRecordStatus = "present" | "absent" | "late" | "early_leave" | "on_leave" | "holiday";

export const registerCheckIn = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { employeeId, employeeName, latitude, longitude, photoUrl, notes } =
      request.data as RegisterCheckInPayload;
    if (!employeeId) {
      throw new HttpsError("invalid-argument", "employeeId es requerido");
    }

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const today = nowIso.split("T")[0]; // YYYY-MM-DD

      // Buscar política por defecto
      const policiesSnap = await companyRef(companyId)
        .collection("attendancePolicies")
        .where("isActive", "==", true)
        .where("isDefault", "==", true)
        .limit(1)
        .get();

      const policy = policiesSnap.empty ? null : policiesSnap.docs[0].data();
      let status: AttendanceRecordStatus = "present";

      if (policy) {
        const [startHour, startMin] = policy.workHoursStart.split(":").map(Number);
        const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
        const toleranceMs = (policy.toleranceMinutesLate || 0) * 60 * 1000;
        if (now.getTime() > scheduledStart.getTime() + toleranceMs) {
          status = "late";
        }
      }

      // Crear evento
      const eventRef = companyRef(companyId).collection("attendanceEvents").doc();
      await eventRef.set({
        companyId,
        employeeId,
        employeeName: employeeName || "",
        eventType: "check_in",
        timestamp: nowIso,
        latitude: latitude || null,
        longitude: longitude || null,
        photoUrl: photoUrl || "",
        notes: notes || "",
        createdBy: request.auth.uid,
        createdAt: nowIso,
      });

      // Buscar o crear registro del día
      const recordsSnap = await companyRef(companyId)
        .collection("attendanceRecords")
        .where("employeeId", "==", employeeId)
        .where("date", "==", today)
        .limit(1)
        .get();

      if (recordsSnap.empty) {
        const recordRef = companyRef(companyId).collection("attendanceRecords").doc();
        await recordRef.set({
          companyId,
          employeeId,
          employeeName: employeeName || "",
          date: today,
          checkIn: nowIso,
          checkInLocation: latitude && longitude ? `${latitude},${longitude}` : "",
          checkInPhoto: photoUrl || "",
          workMinutes: 0,
          overtimeMinutes: 0,
          lunchMinutes: policy?.lunchBreakMinutes ?? 0,
          status,
          notes: notes || "",
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return { success: true, eventId: eventRef.id, recordId: recordRef.id, status };
      } else {
        const recordRef = recordsSnap.docs[0].ref;
        await recordRef.update({
          checkIn: nowIso,
          checkInLocation: latitude && longitude ? `${latitude},${longitude}` : "",
          checkInPhoto: photoUrl || "",
          status,
          updatedAt: nowIso,
        });
        return { success: true, eventId: eventRef.id, recordId: recordRef.id, status };
      }
    } catch (error: any) {
      console.error("[registerCheckIn] Error:", error);
      throw new HttpsError("internal", error.message || "Error al registrar entrada");
    }
  }
);

// ---------- registerCheckOut ----------
interface RegisterCheckOutPayload {
  employeeId: string;
  employeeName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  notes?: string;
}

export const registerCheckOut = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { employeeId, employeeName, latitude, longitude, photoUrl, notes } =
      request.data as RegisterCheckOutPayload;
    if (!employeeId) {
      throw new HttpsError("invalid-argument", "employeeId es requerido");
    }

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const today = nowIso.split("T")[0];

      // Buscar política por defecto
      const policiesSnap = await companyRef(companyId)
        .collection("attendancePolicies")
        .where("isActive", "==", true)
        .where("isDefault", "==", true)
        .limit(1)
        .get();

      const policy = policiesSnap.empty ? null : policiesSnap.docs[0].data();

      // Crear evento
      const eventRef = companyRef(companyId).collection("attendanceEvents").doc();
      await eventRef.set({
        companyId,
        employeeId,
        employeeName: employeeName || "",
        eventType: "check_out",
        timestamp: nowIso,
        latitude: latitude || null,
        longitude: longitude || null,
        photoUrl: photoUrl || "",
        notes: notes || "",
        createdBy: request.auth.uid,
        createdAt: nowIso,
      });

      // Buscar registro del día
      const recordsSnap = await companyRef(companyId)
        .collection("attendanceRecords")
        .where("employeeId", "==", employeeId)
        .where("date", "==", today)
        .limit(1)
        .get();

      if (recordsSnap.empty) {
        throw new HttpsError("not-found", "No se encontró registro de entrada para hoy");
      }

      const recordDoc = recordsSnap.docs[0];
      const recordData = recordDoc.data();
      const checkInStr = recordData.checkIn;
      let workMinutes = 0;
      let overtimeMinutes = 0;
      let status: AttendanceRecordStatus = recordData.status || "present";

      if (checkInStr) {
        const checkInDate = new Date(checkInStr);
        const diffMs = now.getTime() - checkInDate.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const lunchMinutes = policy?.lunchBreakMinutes ?? 0;
        workMinutes = Math.max(0, diffMinutes - lunchMinutes);

        // Verificar salida temprana
        if (policy) {
          const [endHour, endMin] = policy.workHoursEnd.split(":").map(Number);
          const scheduledEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin);
          const toleranceMs = (policy.toleranceMinutesEarly || 0) * 60 * 1000;
          if (now.getTime() < scheduledEnd.getTime() - toleranceMs) {
            if (status === "present") status = "early_leave";
          }
        }

        // Calcular horas extras
        if (policy && policy.overtimeThresholdMinutes > 0) {
          const [startHour, startMin] = policy.workHoursStart.split(":").map(Number);
          const [endHour, endMin] = policy.workHoursEnd.split(":").map(Number);
          const scheduledMinutes = endHour * 60 + endMin - (startHour * 60 + startMin) - lunchMinutes;
          if (workMinutes > scheduledMinutes + policy.overtimeThresholdMinutes) {
            overtimeMinutes = workMinutes - scheduledMinutes;
          }
        }
      }

      await recordDoc.ref.update({
        checkOut: nowIso,
        checkOutLocation: latitude && longitude ? `${latitude},${longitude}` : "",
        checkOutPhoto: photoUrl || "",
        workMinutes,
        overtimeMinutes,
        lunchMinutes: policy?.lunchBreakMinutes ?? recordData.lunchMinutes ?? 0,
        status,
        updatedAt: nowIso,
      });

      return {
        success: true,
        eventId: eventRef.id,
        recordId: recordDoc.id,
        workMinutes,
        overtimeMinutes,
        status,
      };
    } catch (error: any) {
      console.error("[registerCheckOut] Error:", error);
      throw new HttpsError("internal", error.message || "Error al registrar salida");
    }
  }
);

// ---------- getAttendanceRecords ----------
interface GetAttendanceRecordsPayload {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const getAttendanceRecords = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { employeeId, startDate, endDate, limit = 100 } =
      request.data as GetAttendanceRecordsPayload;

    try {
      let q = companyRef(companyId)
        .collection("attendanceRecords")
        .orderBy("date", "desc");

      if (employeeId) {
        q = q.where("employeeId", "==", employeeId);
      }
      if (startDate) {
        q = q.where("date", ">=", startDate);
      }
      if (endDate) {
        q = q.where("date", "<=", endDate);
      }
      q = q.limit(limit);

      const snap = await q.get();
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { success: true, records };
    } catch (error: any) {
      console.error("[getAttendanceRecords] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener registros");
    }
  }
);

// ---------- approveAttendanceRecord ----------
interface ApproveAttendanceRecordPayload {
  recordId: string;
  notes?: string;
}

export const approveAttendanceRecord = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { recordId, notes } = request.data as ApproveAttendanceRecordPayload;
    if (!recordId) {
      throw new HttpsError("invalid-argument", "recordId es requerido");
    }

    try {
      const now = new Date().toISOString();
      const ref = companyRef(companyId).collection("attendanceRecords").doc(recordId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Registro no encontrado");
      }

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
