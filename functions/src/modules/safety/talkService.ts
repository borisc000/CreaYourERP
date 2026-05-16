/**
 * Cloud Functions para Charlas de Seguridad (Safety Talks)
 * - saveTalk / deleteTalk
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface TalkPayload {
  id?: string;
  folderId: string;
  talkDate?: string;
  topic?: string;
  speakerUserId?: string;
  attendeeIds?: string[];
  notes?: string;
}

export const saveTalk = onCall(
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

    await assertAction(request, "safety.save_talk", { companyId });

    const { id, folderId, talkDate, topic, speakerUserId, attendeeIds, notes } =
      request.data as TalkPayload;

    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId es requerido");
    }
    if (!topic || !topic.trim()) {
      throw new HttpsError("invalid-argument", "El tema de la charla es requerido");
    }

    try {
      const now = new Date().toISOString();
      const payload = {
        companyId,
        folderId,
        talkDate: talkDate || now.slice(0, 10),
        topic: topic.trim(),
        speakerUserId: speakerUserId || request.auth.uid,
        attendeeIds: attendeeIds || [],
        attendanceCount: (attendeeIds || []).length,
        notes: notes || "",
        updatedAt: now,
      };

      if (id) {
        const ref = companyRef(companyId).collection("safetyTalks").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Charla no encontrada");
        }
        await ref.update(payload);
        return { success: true, id };
      } else {
        const ref = companyRef(companyId).collection("safetyTalks").doc();
        await ref.set({ ...payload, createdAt: now });
        return { success: true, id: ref.id };
      }
    } catch (error: any) {
      console.error("[saveTalk] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar charla");
    }
  }
);

export const deleteTalk = onCall(
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

    await assertAction(request, "safety.delete_talk", { companyId });

    const { id } = request.data as { id: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      await companyRef(companyId).collection("safetyTalks").doc(id).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteTalk] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar charla");
    }
  }
);
