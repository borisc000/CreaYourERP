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
import * as crypto from "crypto";
import { checkCrewCompliance } from "../accreditation/checkCrewCompliance";
import { registerAccreditationDocument } from "../accreditation/registerAccreditationDocument";
import { checkRateLimit } from "./rateLimit";

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

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export const signDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
    memory: "512MiB",
  },
  async (request) => {
    const companyId = request.auth?.token?.companyId;
    if (!companyId && !request.data.token) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión o proporcionar un token válido");
    }

    const { id, signerName, signerEmail, notes } = request.data as SignPayload & { token?: string };
    if (!id || !signerName || !signerEmail) {
      throw new HttpsError("invalid-argument", "id, signerName y signerEmail son requeridos");
    }

    try {
      let resolvedCompanyId = companyId;
      let signerDocId = id; // For multi-signer, 'id' is the signer doc id
      let signerRef: FirebaseFirestore.DocumentReference | null = null;
      let signerData: any = null;
      let requestRef: FirebaseFirestore.DocumentReference | null = null;
      let requestData: any = null;

      // If token provided, try to resolve signer first (multi-signer mode)
      if (!resolvedCompanyId && request.data.token) {
        // Try signer token first
        const signerQ = await db.collectionGroup("signatureSigners")
          .where("accessToken", "==", request.data.token)
          .where("__name__", "==", id)
          .limit(1)
          .get();

        if (!signerQ.empty) {
          signerRef = signerQ.docs[0].ref;
          signerData = signerQ.docs[0].data();
          signerDocId = signerQ.docs[0].id;
          resolvedCompanyId = signerData.companyId;
          requestRef = companyRef(resolvedCompanyId).collection("signatureRequests").doc(signerData.signatureRequestId);
        } else {
          // Fallback: legacy request token
          const reqQ = await db.collectionGroup("signatureRequests")
            .where("accessToken", "==", request.data.token)
            .where("__name__", "==", id)
            .limit(1)
            .get();
          if (reqQ.empty) {
            throw new HttpsError("not-found", "Solicitud no encontrada");
          }
          requestRef = reqQ.docs[0].ref;
          resolvedCompanyId = reqQ.docs[0].ref.path.match(/companies\/([^/]+)/)?.[1] || "";
        }
      }

      if (!resolvedCompanyId) {
        throw new HttpsError("failed-precondition", "No se pudo determinar la empresa");
      }

      // Resolve request if not done yet
      if (!requestRef) {
        requestRef = companyRef(resolvedCompanyId).collection("signatureRequests").doc(id);
      }
      const reqSnap = await requestRef.get();
      if (!reqSnap.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }
      requestData = reqSnap.data() || {};

      // Rate limiting
      const rateCheck = await checkRateLimit(resolvedCompanyId, request.data.token || request.auth?.uid || "anon");
      if (!rateCheck.allowed) {
        throw new HttpsError("resource-exhausted", "Demasiados intentos. Intenta más tarde.");
      }

      if (requestData.status === "signed" || requestData.status === "closed") {
        throw new HttpsError("failed-precondition", "Documento ya firmado o cerrado");
      }
      if (requestData.expiresAt && new Date(requestData.expiresAt) < new Date()) {
        await requestRef.update({ status: "expired", updatedAt: new Date().toISOString() });
        throw new HttpsError("failed-precondition", "La solicitud ha expirado");
      }

      // Multi-signer validation
      if (requestData.signerMode === "ordered" && signerRef) {
        if (signerData.status !== "sent" && signerData.status !== "pending") {
          throw new HttpsError("failed-precondition", "Este firmante ya ha respondido");
        }
        // Ensure this is the current signer
        const pendingSigners = await companyRef(resolvedCompanyId)
          .collection("signatureSigners")
          .where("signatureRequestId", "==", requestRef.id)
          .where("status", "in", ["pending", "sent"])
          .orderBy("order")
          .limit(1)
          .get();
        if (!pendingSigners.empty && pendingSigners.docs[0].id !== signerDocId) {
          throw new HttpsError("failed-precondition", "No es tu turno para firmar");
        }
      }

      // Load source PDF from Storage
      let sourceBuffer: Buffer | null = null;
      let signedPdfBuffer: Buffer;
      const bucket = storage.bucket();

      if (requestData.storagePath) {
        const [buffer] = await bucket.file(requestData.storagePath).download();
        sourceBuffer = buffer;
        const pdfDoc = await PDFDocument.load(sourceBuffer);
        const pages = pdfDoc.getPages();

        for (const pos of requestData.signaturePositions || []) {
          const pageIdx = Math.min(Math.max(pos.page - 1, 0), pages.length - 1);
          const page = pages[pageIdx];
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            borderColor: rgb(0.2, 0.4, 0.8),
            borderWidth: 1,
          });

          page.drawText(pos.label || "Firma", {
            x: pos.x + 4,
            y: pos.y + pos.height - 14,
            size: 8,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });

          page.drawText(signerName, {
            x: pos.x + 4,
            y: pos.y + pos.height / 2 - 4,
            size: 10,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });

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
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText("DOCUMENTO FIRMADO DIGITALMENTE", { x: 50, y: 700, size: 16, font, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`Documento: ${requestData.name}`, { x: 50, y: 660, size: 12, font });
        page.drawText(`Firmado por: ${signerName} (${signerEmail})`, { x: 50, y: 640, size: 12, font });
        page.drawText(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, { x: 50, y: 620, size: 12, font });
        signedPdfBuffer = Buffer.from(await pdfDoc.save());
      }

      const signedHash = sha256(signedPdfBuffer);
      const signedFileName = `signed_${Date.now()}_${requestData.name?.replace(/\s+/g, "_") || "doc"}.pdf`;
      const signedPath = `companies/${resolvedCompanyId}/signed/${signedFileName}`;
      await bucket.file(signedPath).save(signedPdfBuffer, { metadata: { contentType: "application/pdf" } });

      const now = new Date().toISOString();
      const evidenceJson = {
        signerName,
        signerEmail,
        signedAt: now,
        originalHash: sourceBuffer ? sha256(sourceBuffer) : null,
        signedHash,
        ipAddress: request.rawRequest?.ip || null,
        userAgent: request.rawRequest?.headers?.["user-agent"] || null,
      };

      // Update signer
      if (signerRef && signerData) {
        await signerRef.update({
          status: "signed",
          signedAt: now,
          signedStoragePath: signedPath,
          evidenceJson,
          updatedAt: now,
        });
      }

      // Check if there are more pending signers
      let finalStatus = "signed";
      if (requestData.signerMode === "ordered") {
        const remaining = await companyRef(resolvedCompanyId)
          .collection("signatureSigners")
          .where("signatureRequestId", "==", requestRef.id)
          .where("status", "in", ["pending", "sent"])
          .count()
          .get();
        // We haven't updated the current signer yet in the query, but we will now.
        // Actually, remaining includes the current one if we query before update.
        // Let's query after update or subtract 1.
        const totalPending = remaining.data().count;
        finalStatus = totalPending > 1 ? "sent" : "signed";
      }

      await requestRef.update({
        status: finalStatus,
        signedAt: finalStatus === "signed" ? now : requestData.signedAt || null,
        signedByEmail: finalStatus === "signed" ? signerEmail : requestData.signedByEmail || null,
        signedByName: finalStatus === "signed" ? signerName : requestData.signedByName || null,
        signedStoragePath: finalStatus === "signed" ? signedPath : requestData.signedStoragePath || null,
        originalHash: requestData.originalHash || evidenceJson.originalHash,
        updatedAt: now,
      });

      // Update linked generated document only when fully signed
      if (finalStatus === "signed" && requestData.generatedDocumentId) {
        await companyRef(resolvedCompanyId)
          .collection("generatedDocuments")
          .doc(requestData.generatedDocumentId)
          .update({ status: "signed", signedAt: now, updatedAt: now });
      }

      // Reports loop
      if (requestData.sourceModule === "reports" && requestData.sourceRecordId && finalStatus === "signed") {
        try {
          await companyRef(resolvedCompanyId)
            .collection("reports")
            .doc(requestData.sourceRecordId)
            .update({
              signatureStatus: "signed",
              signedAt: now,
              signedBy: signerEmail,
              updatedAt: now,
            });
        } catch (loopErr: any) {
          console.error("[signDocument] Error actualizando reporte:", loopErr);
        }
      }

      // Accreditation loop
      if (requestData.sourceModule === "accreditation" && finalStatus === "signed") {
        try {
          const dgrSnap = await companyRef(resolvedCompanyId)
            .collection("documentGenerationRequests")
            .where("signatureRequestId", "==", requestRef.id)
            .limit(1)
            .get();

          if (!dgrSnap.empty) {
            const dgrDoc = dgrSnap.docs[0];
            const dgrData = dgrDoc.data();
            await dgrDoc.ref.update({ status: "signed", completedAt: now });
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
        }
      }

      await companyRef(resolvedCompanyId).collection("signatureLogs").add({
        companyId: resolvedCompanyId,
        signatureRequestId: requestRef.id,
        signerId: signerRef?.id || null,
        event: "signed",
        userEmail: signerEmail,
        notes: notes || "",
        metadata: { signerName, signedPath, evidenceJson },
        createdAt: now,
      });

      return { success: true, signedPath, status: finalStatus };
    } catch (error: any) {
      console.error("[signDocument] Error:", error);
      if (error instanceof HttpsError) throw error;
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
