import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

export const approveTimeOffRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.manage_contracts", { companyId });

    const id = cleanString(request.data?.id);
    const approved = request.data?.approved !== false;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId).collection("timeOffRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada");

    const now = new Date().toISOString();
    await ref.update({
      status: approved ? "approved" : "rejected",
      approvedBy: request.auth.uid,
      approvedAt: now,
      updatedAt: now,
    });

    return { approved };
  }
);
