import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// PROCEDURES
// ==========================================

export const listSafetyProcedures = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyProcedureTemplates").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    let procedures = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      procedures = procedures.filter((p: any) =>
        String(p.name || "").toLowerCase().includes(search) ||
        String(p.procedureCode || "").toLowerCase().includes(search)
      );
    }
    return { procedures };
  }
);

export const getSafetyProcedure = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.procedureId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Procedimiento no encontrado");

    const stepsSnap = await companyRef(companyId).collection("safetyProcedureSteps").where("procedureId", "==", id).where("active", "==", true).orderBy("displayOrder").get();
    return { procedure: { id: snap.id, ...snap.data() }, steps: stepsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deleteSafetyProcedure = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const stepsSnap = await ref.collection("safetyProcedureSteps").where("procedureId", "==", id).limit(500).get();
    const versionsSnap = await ref.collection("safetyProcedureVersions").where("procedureId", "==", id).limit(500).get();

    const batch = db.batch();
    for (const doc of stepsSnap.docs) batch.delete(doc.ref);
    for (const doc of versionsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("safetyProcedureTemplates").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { steps: stepsSnap.size, versions: versionsSnap.size } };
  }
);

// ==========================================
// PROCEDURE STEPS
// ==========================================

export const listSafetyProcedureSteps = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.view", { companyId });

    const data = request.data || {};
    const procedureId = cleanString(data.procedureId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyProcedureSteps").where("active", "==", true).orderBy("displayOrder").limit(limit);
    if (procedureId) q = q.where("procedureId", "==", procedureId);

    const snap = await q.get();
    return { steps: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyProcedureStep = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.stepId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyProcedureSteps").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Paso no encontrado");
    return { step: { id: snap.id, ...snap.data() } };
  }
);

export const deleteSafetyProcedureStep = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_procedures.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("safetyProcedureSteps").doc(id).update({ active: false, updatedAt: nowIso() });
    return { deleted: true };
  }
);
