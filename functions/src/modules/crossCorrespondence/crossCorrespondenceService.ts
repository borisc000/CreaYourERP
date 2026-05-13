import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getCorrespondenceDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
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
    const { companyId: _c, ...data } = request.data;
    if (!data.contractId || !data.subject) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("crossCorrespondences").add({
      companyId, contractId: data.contractId, employeeId: data.employeeId || "", leadId: data.leadId || "",
      correspondenceType: data.correspondenceType || "hiring", status: "draft",
      subject: data.subject, bodyHtml: data.bodyHtml || "", bodyText: data.bodyText || "",
      generatedDocumentId: data.generatedDocumentId || "", signatureRequestId: data.signatureRequestId || "",
      createdByUserId: request.auth?.uid || "", createdAt: nowIso(), updatedAt: nowIso(),
    });
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
    const { companyId: _c, id, ...data } = request.data;
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

    // Log event
    await companyRef(companyId).collection("crossCorrespondenceEvents").add({
      companyId, correspondenceId: id, eventType: "correspondence.approved",
      eventData: { approvedBy: request.auth?.uid }, createdAt: nowIso(),
    });

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
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const corr = await companyRef(companyId).collection("crossCorrespondences").doc(id).get();
    if (!corr.exists) throw new HttpsError("not-found", "Correspondencia no encontrada");
    if (corr.data()?.status !== "approved") {
      throw new HttpsError("failed-precondition", "Debe aprobarse antes de enviar a firma");
    }

    await companyRef(companyId).collection("crossCorrespondences").doc(id).update({
      status: "sent_for_signature", sentAt: nowIso(), updatedAt: nowIso(),
    });

    await companyRef(companyId).collection("crossCorrespondenceEvents").add({
      companyId, correspondenceId: id, eventType: "correspondence.sent_for_signature",
      eventData: {}, createdAt: nowIso(),
    });

    return { sent: true };
  }
);
