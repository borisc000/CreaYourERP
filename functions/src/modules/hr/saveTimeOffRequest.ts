import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

export const saveTimeOffRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.edit_employee", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const employeeId = cleanString(data.employeeId);
    if (!employeeId) throw new HttpsError("invalid-argument", "employeeId requerido");

    const startDate = cleanString(data.startDate);
    const endDate = cleanString(data.endDate);
    if (!startDate || !endDate) throw new HttpsError("invalid-argument", "Fechas requeridas");

    const daysRequested = Math.max(1, Number(data.daysRequested) || 1);
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
    } else {
      const ref = companyRef(companyId).collection("timeOffRequests").doc();
      await ref.set({ ...payload, createdAt: now });
      return { id: ref.id, created: true };
    }
  }
);
