import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

export const cancelTimeOffRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.cancel_timeoff", { companyId });
    const uid = request.auth.uid;

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId).collection("timeOffRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada");

    const requestData = snap.data()!;
    const currentStatus = requestData.status;

    if (currentStatus === "cancelled") {
      throw new HttpsError("failed-precondition", "La solicitud ya está cancelada");
    }
    if (currentStatus === "rejected") {
      throw new HttpsError("failed-precondition", "No se puede cancelar una solicitud rechazada");
    }

    const now = new Date().toISOString();

    await db.runTransaction(async (t) => {
      t.update(ref, {
        status: "cancelled",
        cancelledBy: uid,
        cancelledAt: now,
        updatedAt: now,
      });

      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "hr.timeoff.cancelled",
        employeeId: requestData.employeeId,
        timeOffRequestId: id,
        message: `Licencia cancelada: ${requestData.type}`,
        userId: uid,
        metadata: { type: requestData.type, daysRequested: requestData.daysRequested },
        createdAt: now,
      });
    });

    return { cancelled: true };
  }
);
