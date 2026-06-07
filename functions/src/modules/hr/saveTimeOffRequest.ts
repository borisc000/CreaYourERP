import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) count++;
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

export const saveTimeOffRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.edit_employee", { companyId });
    const uid = request.auth.uid;

    const data = request.data || {};
    const id = cleanString(data.id);
    const employeeId = cleanString(data.employeeId);
    if (!employeeId) throw new HttpsError("invalid-argument", "employeeId requerido");

    const startDate = cleanString(data.startDate);
    const endDate = cleanString(data.endDate);
    if (!startDate || !endDate) throw new HttpsError("invalid-argument", "Fechas requeridas");

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new HttpsError("invalid-argument", "Fechas inválidas");
    }
    if (end < start) {
      throw new HttpsError("invalid-argument", "La fecha de término debe ser posterior a la de inicio");
    }

    const autoDays = calculateBusinessDays(startDate, endDate);
    if (autoDays > 365) {
      throw new HttpsError("invalid-argument", "El rango de fechas excede 365 días hábiles");
    }

    const daysRequested = Math.max(1, Number(data.daysRequested) || autoDays);
    const now = new Date().toISOString();

    const payload = {
      companyId,
      employeeId,
      type: cleanString(data.type) || "vacation",
      startDate,
      endDate,
      daysRequested,
      reason: cleanString(data.reason),
      status: cleanString(data.status) || "pending",
      updatedAt: now,
    };

    if (id) {
      const ref = companyRef(companyId).collection("timeOffRequests").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada");
      await ref.update(payload);
      return { id, updated: true };
    }

    const ref = companyRef(companyId).collection("timeOffRequests").doc();

    await db.runTransaction(async (t) => {
      t.set(ref, { ...payload, createdAt: now });
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "hr.timeoff.created",
        employeeId,
        timeOffRequestId: ref.id,
        message: `Solicitud de licencia ${payload.type} creada: ${daysRequested} días`,
        userId: uid,
        metadata: { type: payload.type, daysRequested, startDate, endDate },
        createdAt: now,
      });
    });

    return { id: ref.id, created: true };
  }
);
