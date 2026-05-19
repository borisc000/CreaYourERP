/**
 * Cloud Functions para ciclo de vida de documentos generados
 * - approveGeneratedDocument
 * - closeGeneratedDocument
 * - deleteGeneratedDocument
 * - getDocumentCenterStats
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertAction } from "../../shared/rbac";

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

    await assertAction(request, "document_center.approve_document", { companyId });

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

// ---------- reviewGeneratedDocument ----------
interface ReviewPayload {
  documentId: string;
}

export const reviewGeneratedDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "document_center.review_document", { companyId });

    const { documentId } = request.data as ReviewPayload;
    if (!documentId) throw new HttpsError("invalid-argument", "documentId es requerido");

    const ref = companyRef(companyId).collection("generatedDocuments").doc(documentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");
    const data = snap.data()!;
    if (data.status !== "generated") throw new HttpsError("failed-precondition", "Solo documentos en estado 'generated' pueden pasar a revisión");

    const now = new Date().toISOString();
    await ref.update({ status: "ready_for_review", reviewedBy: request.auth.uid, reviewedAt: now, updatedAt: now });
    await companyRef(companyId).collection("documentEventLogs").add({ companyId, documentId, event: "ready_for_review", userId: request.auth.uid, createdAt: now });
    return { success: true };
  }
);

// ---------- sendGeneratedDocumentToSignature ----------
interface SendToSignaturePayload {
  documentId: string;
  signerEmail?: string;
  signerName?: string;
  signaturePositions?: any[];
}

export const sendGeneratedDocumentToSignature = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "document_center.send_to_signature", { companyId });

    const { documentId, signerEmail, signerName, signaturePositions } = request.data as SendToSignaturePayload;
    if (!documentId) throw new HttpsError("invalid-argument", "documentId es requerido");

    const ref = companyRef(companyId).collection("generatedDocuments").doc(documentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");
    const data = snap.data()!;
    if (data.status !== "approved") throw new HttpsError("failed-precondition", "El documento debe estar aprobado antes de enviar a firma");

    const resolvedSignerEmail = signerEmail || data.recipientEmail || "";
    const resolvedSignerName = signerName || data.recipientName || "";
    if (!resolvedSignerEmail) throw new HttpsError("invalid-argument", "No se pudo determinar el email del firmante");

    // Create signature request
    const now = new Date().toISOString();
    const token = generateToken();
    const sigRef = companyRef(companyId).collection("signatureRequests").doc();
    await sigRef.set({
      companyId,
      name: data.name,
      description: `Documento generado: ${data.templateName}`,
      requestFrom: request.auth.uid,
      requestToEmail: resolvedSignerEmail,
      requestToName: resolvedSignerName,
      generatedDocumentId: documentId,
      storagePath: data.storagePath || "",
      signaturePositions: signaturePositions || [],
      status: "draft",
      accessToken: token,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await ref.update({ status: "signature_pending", signatureRequestId: sigRef.id, updatedAt: now });
    await companyRef(companyId).collection("documentEventLogs").add({ companyId, documentId, event: "signature_pending", signatureRequestId: sigRef.id, userId: request.auth.uid, createdAt: now });

    return { success: true, signatureRequestId: sigRef.id, token };
  }
);

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

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

    await assertAction(request, "document_center.close_document", { companyId });

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

      const docData = snap.data()!;
      // Require signed status before closing if signature was required
      if (docData.requiresSignature && docData.status !== "signed") {
        throw new HttpsError("failed-precondition", "El documento requiere firma antes de cerrarse");
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

    await assertAction(request, "document_center.delete_document", { companyId });

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

    await assertAction(request, "document_center.view_stats", { companyId });

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
