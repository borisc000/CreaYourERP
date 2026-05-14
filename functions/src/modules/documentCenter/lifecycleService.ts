/**
 * Cloud Functions para ciclo de vida de documentos generados
 * - approveGeneratedDocument
 * - closeGeneratedDocument
 * - deleteGeneratedDocument
 * - getDocumentCenterStats
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ---------- approveGeneratedDocument ----------
interface ApprovePayload {
  documentId: string;
}

export const approveGeneratedDocument = onCall(
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

    const { documentId } = request.data as ApprovePayload;
    if (!documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("generatedDocuments").doc(documentId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }

      const now = new Date().toISOString();
      await ref.update({
        status: "approved",
        approvedBy: request.auth.uid,
        approvedAt: now,
        updatedAt: now,
      });

      // Log event
      await companyRef(companyId).collection("documentEventLogs").add({
        companyId,
        documentId,
        event: "approved",
        userId: request.auth.uid,
        createdAt: now,
      });

      return { success: true };
    } catch (error: any) {
      console.error("[approveGeneratedDocument] Error:", error);
      throw new HttpsError("internal", error.message || "Error al aprobar documento");
    }
  }
);

// ---------- closeGeneratedDocument ----------
interface ClosePayload {
  documentId: string;
}

export const closeGeneratedDocument = onCall(
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

    const { documentId } = request.data as ClosePayload;
    if (!documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("generatedDocuments").doc(documentId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }

      const now = new Date().toISOString();
      await ref.update({
        status: "closed",
        closedBy: request.auth.uid,
        closedAt: now,
        updatedAt: now,
      });

      await companyRef(companyId).collection("documentEventLogs").add({
        companyId,
        documentId,
        event: "closed",
        userId: request.auth.uid,
        createdAt: now,
      });

      return { success: true };
    } catch (error: any) {
      console.error("[closeGeneratedDocument] Error:", error);
      throw new HttpsError("internal", error.message || "Error al cerrar documento");
    }
  }
);

// ---------- deleteGeneratedDocument ----------
interface DeletePayload {
  documentId: string;
}

export const deleteGeneratedDocument = onCall(
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

    const { documentId } = request.data as DeletePayload;
    if (!documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("generatedDocuments").doc(documentId);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.storagePath) {
          try {
            await storage.bucket().file(data.storagePath).delete();
          } catch (e) {
            console.warn("Could not delete storage file:", e);
          }
        }
      }

      await ref.delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteGeneratedDocument] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar documento");
    }
  }
);

// ---------- getDocumentCenterStats ----------
export const getDocumentCenterStats = onCall(
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

    try {
      const cRef = companyRef(companyId);
      const [templatesSnap, generatedSnap] = await Promise.all([
        cRef.collection("documentTemplates").where("status", "==", "active").count().get(),
        cRef.collection("generatedDocuments").count().get(),
      ]);

      // Status breakdown
      const statuses = ["generated", "ready_for_review", "approved", "signature_pending", "signed", "closed", "error"];
      const statusCounts: Record<string, number> = {};
      await Promise.all(
        statuses.map(async (s) => {
          const snap = await cRef.collection("generatedDocuments").where("status", "==", s).count().get();
          statusCounts[s] = snap.data().count;
        })
      );

      return {
        success: true,
        activeTemplates: templatesSnap.data().count,
        totalGenerated: generatedSnap.data().count,
        statusBreakdown: statusCounts,
      };
    } catch (error: any) {
      console.error("[getDocumentCenterStats] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener estadísticas");
    }
  }
);
