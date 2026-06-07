import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

export const approveRiskMatrix = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.approve_matrix", { companyId });

    const id = cleanString(request.data?.id || request.data?.matrixId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId).collection("safetyRiskMatrices").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Matriz no encontrada");

    const data = snap.data() || {};
    if (data.approvalBlocked) {
      throw new HttpsError("failed-precondition", "La matriz tiene riesgos críticos que bloquean la aprobación");
    }

    await ref.update({
      status: "approved",
      approvedBy: request.auth?.uid || "",
      approvedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { approved: true };
  }
);
