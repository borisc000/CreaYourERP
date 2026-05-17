import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { sendSignatureEmail } from "./emailService";

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

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

// ---------- createMultiSignerRequest ----------
interface SignerInput {
  name: string;
  email: string;
}

interface CreateMultiPayload {
  name: string;
  description?: string;
  signers: SignerInput[];
  generatedDocumentId?: string;
  storagePath?: string;
  signaturePositions?: SignatureRequest["signaturePositions"];
  expiresAt?: string;
}

type SignatureRequest = {
  signaturePositions?: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fieldType?: string;
    label?: string;
  }>;
};

export const createMultiSignerRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "signature.create_request", { companyId });

    const payload = request.data as CreateMultiPayload;
    if (!payload.name?.trim() || !payload.signers?.length) {
      throw new HttpsError("invalid-argument", "Nombre y al menos un firmante son requeridos");
    }

    try {
      const now = new Date().toISOString();
      const reqRef = companyRef(companyId).collection("signatureRequests").doc();
      const requestId = reqRef.id;

      await reqRef.set({
        companyId,
        name: payload.name.trim(),
        description: payload.description || "",
        requestFrom: request.auth.uid,
        requestToEmail: payload.signers[0].email,
        requestToName: payload.signers[0].name,
        generatedDocumentId: payload.generatedDocumentId || null,
        storagePath: payload.storagePath || "",
        signaturePositions: payload.signaturePositions || [],
        status: "draft",
        signerMode: "ordered",
        currentSignerOrder: 1,
        accessToken: generateToken(),
        expiresAt: payload.expiresAt || null,
        createdAt: now,
        updatedAt: now,
      });

      // Create signer subdocs
      const batch = db.batch();
      for (let i = 0; i < payload.signers.length; i++) {
        const s = payload.signers[i];
        const signerRef = companyRef(companyId).collection("signatureSigners").doc();
        batch.set(signerRef, {
          companyId,
          signatureRequestId: requestId,
          order: i + 1,
          name: s.name,
          email: s.email,
          status: "pending",
          accessToken: generateToken(),
          createdAt: now,
        });
      }
      await batch.commit();

      return { success: true, id: requestId };
    } catch (error: any) {
      console.error("[createMultiSignerRequest] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear solicitud");
    }
  }
);

// ---------- sendNextSignatureInvitation ----------
interface SendNextPayload {
  requestId: string;
}

export const sendNextSignatureInvitation = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "signature.send_request", { companyId });

    const { requestId } = request.data as SendNextPayload;
    if (!requestId) {
      throw new HttpsError("invalid-argument", "requestId es requerido");
    }

    try {
      const now = new Date().toISOString();

      // Find next pending signer in order
      const signerSnap = await companyRef(companyId)
        .collection("signatureSigners")
        .where("signatureRequestId", "==", requestId)
        .where("status", "==", "pending")
        .orderBy("order")
        .limit(1)
        .get();

      if (signerSnap.empty) {
        throw new HttpsError("failed-precondition", "No hay firmantes pendientes");
      }

      const signerDoc = signerSnap.docs[0];
      const signer = signerDoc.data();

      // Get request details
      const reqRef = companyRef(companyId).collection("signatureRequests").doc(requestId);
      const reqSnap = await reqRef.get();
      if (!reqSnap.exists) {
        throw new HttpsError("not-found", "Solicitud no encontrada");
      }
      const reqData = reqSnap.data() || {};

      // Build signing URL
      const origin = request.rawRequest?.headers?.origin || "https://your-erp.web.app";
      const signUrl = `${origin}/sign/${signerDoc.id}?token=${signer.accessToken}`;

      // Send email
      await sendSignatureEmail(companyId, signer.email, signer.name, reqData.name, signUrl);

      // Update signer status
      await signerDoc.ref.update({ status: "sent", sentAt: now });

      // Update request
      await reqRef.update({
        status: "sent",
        requestToEmail: signer.email,
        requestToName: signer.name,
        currentSignerOrder: signer.order,
        updatedAt: now,
      });

      // Update linked generated document
      if (reqData.generatedDocumentId) {
        await companyRef(companyId)
          .collection("generatedDocuments")
          .doc(reqData.generatedDocumentId)
          .update({ status: "signature_pending", updatedAt: now });
      }

      return { success: true, signerId: signerDoc.id, email: signer.email };
    } catch (error: any) {
      console.error("[sendNextSignatureInvitation] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al enviar invitación");
    }
  }
);
