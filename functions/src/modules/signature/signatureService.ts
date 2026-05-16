/**
 * Cloud Functions para Firma Digital (Signature)
 * - createSignatureRequest: Crea solicitud con token de acceso público
 * - sendSignatureRequest: Marca como enviada
 * - signDocument: Firma el documento, incrusta firma en PDF con pdf-lib
 * - deleteSignatureRequest: Elimina solicitud + archivo firmado
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { checkCrewCompliance } from "../accreditation/checkCrewCompliance";
import { registerAccreditationDocument } from "../accreditation/registerAccreditationDocument";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ---------- createSignatureRequest ----------
interface CreatePayload {
  name: string;
  description?: string;
  requestToEmail: string;
  requestToName?: string;
  generatedDocumentId?: string;
  storagePath?: string;
  signaturePositions?: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fieldType?: string;
    label?: string;
  }>;
  expiresAt?: string;
}

export const createSignatureRequest = onCall(
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

    const payload = request.data as CreatePayload;
    if (!payload.name?.trim() || !payload.requestToEmail?.trim()) {
      throw new HttpsError("invalid-argument", "Nombre y email del destinatario son requeridos");
    }

    try {
      const now = new Date().toISOString();
      const token = generateToken();

      const ref = companyRef(companyId).collection("signatureRequests").doc();
      await ref.set({
        companyId,
        name: payload.name.trim(),
        description: payload.description || "",
        requestFrom: request.auth.uid,
        requestToEmail: payload.requestToEmail.trim(),
        requestToName: payload.requestToName || "",
        generatedDocumentId: payload.generatedDocumentId || null,
        storagePath: payload.storagePath || "",
        signaturePositions: payload.signaturePositions || [],
        status: "draft",
        accessToken: token,
        expiresAt: payload.expiresAt || null,
        createdAt: now,
        updatedAt: now,
      });

      // Log
      await companyRef(companyId).collection("signatureLogs").add({
        companyId,
        signatureRequestId: ref.id,
        event: "created",
        userId: request.auth.uid,
        createdAt: now,
      });

      return { success: true, id: ref.id, token };
    } catch (error: any) {
      console.error("[createSignatureRequest] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear solicitud");
    }
  }
);

// ---------- sendSignatureRequest ----------
interface SendPayload {
  id: string;
}

export const sendSignatureRequest = onCall(
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

    const { id } = request.data as SendPayload;
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      const now = new Date().toISOString();
      const ref = companyRef(companyId).collection("signatureRequests").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }

      await ref.update({ status: "sent", updatedAt: now });

      // If linked to a generated document, update its status
      const data = snap.data() || {};
      if (data.generatedDocumentId) {
        await companyRef(companyId)
          .collection("generatedDocuments")
          .doc(data.generatedDocumentId)
          .update({ status: "signature_pending", updatedAt: now });
      }

      await companyRef(companyId).collection("signatureLogs").add({
        companyId,
        signatureRequestId: id,
        event: "sent",
        userId: request.auth.uid,
        createdAt: now,
      });

      return { success: true };
    } catch (error: any) {
      console.error("[sendSignatureRequest] Error:", error);
      throw new HttpsError("internal", error.message || "Error al enviar solicitud");
    }
  }
);

// ---------- signDocument ----------
interface SignPayload {
  id: string;
  signerName: string;
  signerEmail: string;
  notes?: string;
}

export const signDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
    memory: "512MiB",
  },
  async (request) => {
    // Allow both authenticated and token-based signing
    const companyId = request.auth?.token?.companyId;
    if (!companyId && !request.data.token) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión o proporcionar un token válido");
    }

    const { id, signerName, signerEmail, notes } = request.data as SignPayload & { token?: string };
    if (!id || !signerName || !signerEmail) {
      throw new HttpsError("invalid-argument", "id, signerName y signerEmail son requeridos");
    }

    try {
      // Find request by id and verify company
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId && request.data.token) {
        // Token-based lookup (public signing)
        const q = await db.collectionGroup("signatureRequests")
          .where("accessToken", "==", request.data.token)
          .where("__name__", "==", id)
          .limit(1)
          .get();
        if (q.empty) {
          throw new HttpsError("not-found", "Solicitud no encontrada");
        }
        const path = q.docs[0].ref.path;
        const match = path.match(/companies\/([^/]+)/);
        if (match) resolvedCompanyId = match[1];
      }

      if (!resolvedCompanyId) {
        throw new HttpsError("failed-precondition", "No se pudo determinar la empresa");
      }

      const ref = companyRef(resolvedCompanyId).collection("signatureRequests").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }

      const sigData = snap.data() || {};
      if (sigData.status === "signed" || sigData.status === "closed") {
        throw new HttpsError("failed-precondition", "Documento ya firmado o cerrado");
      }
      if (sigData.expiresAt && new Date(sigData.expiresAt) < new Date()) {
        await ref.update({ status: "expired", updatedAt: new Date().toISOString() });
        throw new HttpsError("failed-precondition", "La solicitud ha expirado");
      }

      // Load source PDF from Storage
      let signedPdfBuffer: Buffer;
      if (sigData.storagePath) {
        const bucket = storage.bucket();
        const [buffer] = await bucket.file(sigData.storagePath).download();
        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();

        // Embed signature annotation on each position
        for (const pos of sigData.signaturePositions || []) {
          const pageIdx = Math.min(Math.max(pos.page - 1, 0), pages.length - 1);
          const page = pages[pageIdx];
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

          // Draw border
          page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            borderColor: rgb(0.2, 0.4, 0.8),
            borderWidth: 1,
          });

          // Draw label
          page.drawText(pos.label || "Firma", {
            x: pos.x + 4,
            y: pos.y + pos.height - 14,
            size: 8,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });

          // Draw signer name
          page.drawText(signerName, {
            x: pos.x + 4,
            y: pos.y + pos.height / 2 - 4,
            size: 10,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });

          // Draw date
          page.drawText(new Date().toLocaleDateString("es-CL"), {
            x: pos.x + 4,
            y: pos.y + 4,
            size: 8,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
        }

        signedPdfBuffer = Buffer.from(await pdfDoc.save());
      } else {
        // No source PDF, create a simple one
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText(`DOCUMENTO FIRMADO DIGITALMENTE`, { x: 50, y: 700, size: 16, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`Documento: ${sigData.name}`, { x: 50, y: 660, size: 12, font });
        page.drawText(`Firmado por: ${signerName} (${signerEmail})`, { x: 50, y: 640, size: 12, font });
        page.drawText(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, { x: 50, y: 620, size: 12, font });
        signedPdfBuffer = Buffer.from(await pdfDoc.save());
      }

      // Save signed PDF to Storage
      const bucket = storage.bucket();
      const signedFileName = `signed_${Date.now()}_${sigData.name?.replace(/\s+/g, "_") || "doc"}.pdf`;
      const signedPath = `companies/${resolvedCompanyId}/signed/${signedFileName}`;
      await bucket.file(signedPath).save(signedPdfBuffer, { metadata: { contentType: "application/pdf" } });

      const now = new Date().toISOString();
      await ref.update({
        status: "signed",
        signedAt: now,
        signedByEmail: signerEmail,
        signedByName: signerName,
        signedStoragePath: signedPath,
        updatedAt: now,
      });

      // Update linked generated document
      if (sigData.generatedDocumentId) {
        await companyRef(resolvedCompanyId)
          .collection("generatedDocuments")
          .doc(sigData.generatedDocumentId)
          .update({ status: "signed", signedAt: now, updatedAt: now });
      }

      // Cierre de loop para documentos de acreditación
      if (sigData.sourceModule === "accreditation") {
        try {
          // Buscar DocumentGenerationRequest vinculado
          const dgrSnap = await companyRef(resolvedCompanyId)
            .collection("documentGenerationRequests")
            .where("signatureRequestId", "==", id)
            .limit(1)
            .get();

          if (!dgrSnap.empty) {
            const dgrDoc = dgrSnap.docs[0];
            const dgrData = dgrDoc.data();
            await dgrDoc.ref.update({ status: "signed", completedAt: now });

            // Registrar acreditación como aprobada
            await registerAccreditationDocument({
              companyId: resolvedCompanyId,
              employeeId: dgrData.employeeId,
              requirementId: dgrData.requirementId,
              generatedDocumentId: dgrData.generatedDocumentId,
              storagePath: signedPath,
              verificationStatus: "approved",
              signatureStatus: "signed",
              signedDocumentUrl: signedPath,
              validUntil: dgrData.validUntil || null,
            });

            // Recompute check
            const assignmentSnap = await companyRef(resolvedCompanyId)
              .collection("crewAssignments")
              .where("serviceOrderId", "==", dgrData.serviceOrderId)
              .where("employeeId", "==", dgrData.employeeId)
              .where("status", "in", ["assigned", "active"])
              .limit(1)
              .get();

            if (!assignmentSnap.empty) {
              const assignmentDoc = assignmentSnap.docs[0];
              await checkCrewCompliance(resolvedCompanyId, assignmentDoc.id, {
                serviceOrderId: dgrData.serviceOrderId,
                employeeId: dgrData.employeeId,
                role: assignmentDoc.data().role || "worker",
              });
            }
          }
        } catch (loopErr: any) {
          console.error("[signDocument] Error cerrando loop de acreditación:", loopErr);
          // No fallamos la firma si el loop falla
        }
      }

      await companyRef(resolvedCompanyId).collection("signatureLogs").add({
        companyId: resolvedCompanyId,
        signatureRequestId: id,
        event: "signed",
        userEmail: signerEmail,
        notes: notes || "",
        metadata: { signerName, signedPath },
        createdAt: now,
      });

      return { success: true, signedPath };
    } catch (error: any) {
      console.error("[signDocument] Error:", error);
      throw new HttpsError("internal", error.message || "Error al firmar documento");
    }
  }
);

// ---------- deleteSignatureRequest ----------
interface DeletePayload {
  id: string;
}

export const deleteSignatureRequest = onCall(
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

    const { id } = request.data as DeletePayload;
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("signatureRequests").doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.signedStoragePath) {
          try {
            await storage.bucket().file(data.signedStoragePath).delete();
          } catch (e) {
            console.warn("Could not delete signed file:", e);
          }
        }
      }
      await ref.delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteSignatureRequest] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar");
    }
  }
);
