import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

async function createEvent(companyId: string, type: string, payload: Record<string, unknown>) {
  await companyRef(companyId).collection("events").add({
    companyId,
    type,
    payload,
    createdAt: nowIso(),
    processed: false,
  });
}

export const getCorrespondenceDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.view", { companyId });
    const snap = await companyRef(companyId).collection("crossCorrespondences").orderBy("createdAt", "desc").get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      total: list.length,
      byStatus: {
        draft: list.filter((c: any) => c.status === "draft").length,
        review: list.filter((c: any) => c.status === "review").length,
        approved: list.filter((c: any) => c.status === "approved").length,
        sent_for_signature: list.filter((c: any) => c.status === "sent_for_signature").length,
        signed: list.filter((c: any) => c.status === "signed").length,
        delivered: list.filter((c: any) => c.status === "delivered").length,
      },
      correspondences: list.slice(0, 20),
    };
  }
);

export const createCorrespondence = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.contractId || !data.subject) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("crossCorrespondences").add({
      companyId, contractId: data.contractId, employeeId: data.employeeId || "", leadId: data.leadId || "",
      correspondenceType: data.correspondenceType || "hiring", status: "draft",
      subject: data.subject, bodyHtml: data.bodyHtml || "", bodyText: data.bodyText || "",
      generatedDocumentId: data.generatedDocumentId || "", signatureRequestId: data.signatureRequestId || "",
      createdByUserId: request.auth?.uid || "", createdAt: nowIso(), updatedAt: nowIso(),
    });

    await createEvent(companyId, "correspondence.created", { correspondenceId: ref.id, contractId: data.contractId });

    return { id: ref.id };
  }
);

export const updateCorrespondence = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("crossCorrespondences").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const approveCorrespondence = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.edit", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const corr = await companyRef(companyId).collection("crossCorrespondences").doc(id).get();
    if (!corr.exists) throw new HttpsError("not-found", "Correspondencia no encontrada");
    if (corr.data()?.status !== "draft" && corr.data()?.status !== "review") {
      throw new HttpsError("failed-precondition", "Solo se puede aprobar borradores o en revisión");
    }

    await companyRef(companyId).collection("crossCorrespondences").doc(id).update({
      status: "approved", approvedByUserId: request.auth?.uid || "", approvedAt: nowIso(), updatedAt: nowIso(),
    });

    await companyRef(companyId).collection("crossCorrespondenceEvents").add({
      companyId, correspondenceId: id, eventType: "correspondence.approved",
      eventData: { approvedBy: request.auth?.uid }, createdAt: nowIso(),
    });

    await createEvent(companyId, "correspondence.approved", { correspondenceId: id, approvedBy: request.auth?.uid });

    return { approved: true };
  }
);

export const sendCorrespondenceForSignature = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.send_for_signature", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const corr = await companyRef(companyId).collection("crossCorrespondences").doc(id).get();
    if (!corr.exists) throw new HttpsError("not-found", "Correspondencia no encontrada");
    const corrData = corr.data()!;
    if (corrData.status !== "approved") {
      throw new HttpsError("failed-precondition", "Debe aprobarse antes de enviar a firma");
    }

    const now = nowIso();

    // Resolve signer details from linked generated document or employee
    let signerEmail = "";
    let signerName = "";
    let storagePath = "";

    if (corrData.generatedDocumentId) {
      const genDoc = await companyRef(companyId).collection("generatedDocuments").doc(corrData.generatedDocumentId).get();
      if (genDoc.exists) {
        const genData = genDoc.data()!;
        signerEmail = genData.recipientEmail || "";
        signerName = genData.recipientName || "";
        storagePath = genData.storagePath || "";
      }
    }

    if (!signerEmail && corrData.employeeId) {
      const emp = await companyRef(companyId).collection("employees").doc(corrData.employeeId).get();
      if (emp.exists) {
        const empData = emp.data()!;
        signerEmail = empData.email || "";
        signerName = empData.fullName || `${empData.firstName || ""} ${empData.lastName || ""}`.trim();
      }
    }

    if (!signerEmail) {
      throw new HttpsError("failed-precondition", "No se pudo determinar el email del firmante");
    }

    // Create signature request
    const token = generateToken();
    const sigRef = companyRef(companyId).collection("signatureRequests").doc();
    await sigRef.set({
      companyId,
      name: corrData.subject,
      description: `Correspondencia cruzada: ${corrData.correspondenceType}`,
      requestFrom: request.auth.uid,
      requestToEmail: signerEmail,
      requestToName: signerName,
      generatedDocumentId: corrData.generatedDocumentId || null,
      storagePath: storagePath || "",
      signaturePositions: [],
      status: "draft",
      accessToken: token,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Update correspondence
    await companyRef(companyId).collection("crossCorrespondences").doc(id).update({
      status: "sent_for_signature",
      signatureRequestId: sigRef.id,
      sentAt: now,
      updatedAt: now,
    });

    await companyRef(companyId).collection("crossCorrespondenceEvents").add({
      companyId, correspondenceId: id, eventType: "correspondence.sent_for_signature",
      eventData: { signatureRequestId: sigRef.id }, createdAt: now,
    });

    await createEvent(companyId, "correspondence.sent_for_signature", { correspondenceId: id, signatureRequestId: sigRef.id });

    return { sent: true, signatureRequestId: sigRef.id, token };
  }
);

export const deliverCorrespondence = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "cross_correspondence.deliver", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const corr = await companyRef(companyId).collection("crossCorrespondences").doc(id).get();
    if (!corr.exists) throw new HttpsError("not-found", "Correspondencia no encontrada");
    if (corr.data()?.status !== "signed") {
      throw new HttpsError("failed-precondition", "Debe estar firmado antes de entregar");
    }

    const now = nowIso();
    await companyRef(companyId).collection("crossCorrespondences").doc(id).update({
      status: "delivered",
      deliveredBy: request.auth.uid,
      deliveredAt: now,
      updatedAt: now,
    });

    await companyRef(companyId).collection("crossCorrespondenceEvents").add({
      companyId, correspondenceId: id, eventType: "correspondence.delivered",
      eventData: { deliveredBy: request.auth.uid }, createdAt: now,
    });

    await createEvent(companyId, "correspondence.delivered", { correspondenceId: id, deliveredBy: request.auth.uid });

    return { delivered: true };
  }
);
