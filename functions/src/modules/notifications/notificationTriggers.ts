/**
 * Firestore triggers that auto-generate in-app notifications
 * for key business events across modules.
 */

import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

function nowIso() {
  return new Date().toISOString();
}

async function createSystemNotification(
  companyId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const ref = db.collection("companies").doc(companyId).collection("notifications").doc();
    await ref.set({
      id: ref.id,
      companyId,
      userId: "", // system-wide notification
      type,
      title,
      body,
      read: false,
      data: data || {},
      createdAt: nowIso(),
    });
  } catch (err) {
    console.error("[notificationTriggers] Error creating notification:", err);
  }
}

// ==========================================
// Trigger: Signature request created
// ==========================================

export const onSignatureRequestCreated = onDocumentCreated(
  { region: "us-central1", document: "companies/{companyId}/signatureRequests/{requestId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const companyId = event.params.companyId;

    await createSystemNotification(
      companyId,
      "signature.requested",
      "Nueva solicitud de firma",
      `Se creó una solicitud de firma para "${data.documentName || "documento"}"`,
      { signatureRequestId: event.params.requestId, documentName: data.documentName }
    );
  }
);

// ==========================================
// Trigger: Billing document SII accepted
// ==========================================

export const onBillingDocumentSiiAccepted = onDocumentUpdated(
  { region: "us-central1", document: "companies/{companyId}/billingDocuments/{docId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const companyId = event.params.companyId;

    if (before.siiStatus !== "accepted" && after.siiStatus === "accepted") {
      await createSystemNotification(
        companyId,
        "billing.sii_accepted",
        "Documento aceptado por SII",
        `El documento ${after.documentNumber || ""} fue aceptado por el SII`,
        { billingDocumentId: event.params.docId, documentNumber: after.documentNumber }
      );
    }
  }
);

// ==========================================
// Trigger: Safety risk matrix generated
// ==========================================

export const onSafetyMatrixGenerated = onDocumentCreated(
  { region: "us-central1", document: "companies/{companyId}/safetyRiskMatrices/{matrixId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const companyId = event.params.companyId;

    await createSystemNotification(
      companyId,
      "safety.matrix_generated",
      "Matriz MIPER generada",
      `Se generó una nueva matriz de riesgos para la carpeta ${data.folderId || ""}`,
      { matrixId: event.params.matrixId, folderId: data.folderId }
    );
  }
);
