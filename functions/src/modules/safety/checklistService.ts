/**
 * Cloud Functions para Checklists de Seguridad
 * - saveChecklist / deleteChecklist
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface ChecklistPayload {
  id?: string;
  folderId: string;
  checklistName?: string;
  checklistType?: string;
  executedAt?: string;
  result?: "pending" | "ok" | "critical";
  items?: string[];
  findings?: string;
  requiresAction?: boolean;
}

export const saveChecklist = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.save_checklist", { companyId });

    const { id, folderId, checklistName, checklistType, executedAt, result, items, findings, requiresAction } =
      request.data as ChecklistPayload;

    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId es requerido");
    }
    if (!checklistName || !checklistName.trim()) {
      throw new HttpsError("invalid-argument", "El nombre del checklist es requerido");
    }

    try {
      const now = new Date().toISOString();
      const payload = {
        companyId,
        folderId,
        checklistName: checklistName.trim(),
        checklistType: checklistType || "",
        executedAt: executedAt || now.slice(0, 10),
        executedBy: request.auth.uid,
        result: result || "pending",
        items: items || [],
        findings: findings || "",
        requiresAction: !!requiresAction,
        updatedAt: now,
      };

      if (id) {
        const ref = companyRef(companyId).collection("safetyChecklists").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Checklist no encontrado");
        }
        await ref.update(payload);
        return { success: true, id };
      } else {
        const ref = companyRef(companyId).collection("safetyChecklists").doc();
        await ref.set({ ...payload, createdAt: now });
        return { success: true, id: ref.id };
      }
    } catch (error: any) {
      console.error("[saveChecklist] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar checklist");
    }
  }
);

export const deleteChecklist = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.delete_checklist", { companyId });

    const { id } = request.data as { id: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      await companyRef(companyId).collection("safetyChecklists").doc(id).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteChecklist] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar checklist");
    }
  }
);
