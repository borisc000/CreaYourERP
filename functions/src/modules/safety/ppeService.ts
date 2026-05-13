/**
 * Cloud Functions para Entregas de EPP
 * - createPPEDelivery / updatePPEDelivery / deletePPEDelivery
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface PPEDeliveryPayload {
  id?: string;
  folderId: string;
  employeeId: string;
  deliveryDate?: string;
  status?: "draft" | "delivered" | "replenishment";
  items?: string[];
  notes?: string;
  documentTemplateId?: string;
}

export const savePPEDelivery = onCall(
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

    const { id, folderId, employeeId, deliveryDate, status, items, notes, documentTemplateId } =
      request.data as PPEDeliveryPayload;

    if (!folderId || !employeeId) {
      throw new HttpsError("invalid-argument", "folderId y employeeId son requeridos");
    }

    try {
      // Verify folder exists
      const folderSnap = await companyRef(companyId).collection("safetyFolders").doc(folderId).get();
      if (!folderSnap.exists) {
        throw new HttpsError("not-found", "Carpeta no encontrada");
      }

      // Verify employee exists and get name
      const empSnap = await companyRef(companyId).collection("employees").doc(employeeId).get();
      if (!empSnap.exists) {
        throw new HttpsError("not-found", "Empleado no encontrado");
      }
      const emp = empSnap.data() || {};
      const employeeName = emp.fullName || `${emp.firstName} ${emp.lastName}` || "Trabajador";

      const now = new Date().toISOString();
      const payload = {
        companyId,
        folderId,
        employeeId,
        employeeName,
        deliveryDate: deliveryDate || now.slice(0, 10),
        status: status || "delivered",
        items: items || [],
        notes: notes || "",
        documentTemplateId: documentTemplateId || "",
        updatedAt: now,
      };

      if (id) {
        const ref = companyRef(companyId).collection("safetyPPEDeliveries").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Entrega no encontrada");
        }
        await ref.update(payload);
        return { success: true, id };
      } else {
        const ref = companyRef(companyId).collection("safetyPPEDeliveries").doc();
        await ref.set({ ...payload, createdAt: now });
        return { success: true, id: ref.id };
      }
    } catch (error: any) {
      console.error("[savePPEDelivery] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar entrega EPP");
    }
  }
);

export const deletePPEDelivery = onCall(
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

    const { id } = request.data as { id: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      await companyRef(companyId).collection("safetyPPEDeliveries").doc(id).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deletePPEDelivery] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar entrega EPP");
    }
  }
);
