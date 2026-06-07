import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// ACTIVITY BLOCKS
// ==========================================

export const listSafetyActivityBlocks = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyActivityBlocks").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    let blocks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      blocks = blocks.filter((b: any) =>
        String(b.name || "").toLowerCase().includes(search) ||
        String(b.code || "").toLowerCase().includes(search)
      );
    }
    return { blocks };
  }
);

export const getSafetyActivityBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.blockId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyActivityBlocks").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Bloque no encontrado");

    const hazardsSnap = await companyRef(companyId).collection("safetyActivityHazards").where("activityBlockId", "==", id).get();
    return { block: { id: snap.id, ...snap.data() }, hazards: hazardsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deleteSafetyActivityBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const hazardsSnap = await ref.collection("safetyActivityHazards").where("activityBlockId", "==", id).limit(500).get();
    const batch = db.batch();
    for (const doc of hazardsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("safetyActivityBlocks").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { hazards: hazardsSnap.size } };
  }
);

// ==========================================
// ACTIVITY HAZARDS
// ==========================================

export const listSafetyActivityHazards = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.view", { companyId });

    const data = request.data || {};
    const activityBlockId = cleanString(data.activityBlockId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyActivityHazards").orderBy("createdAt", "desc").limit(limit);
    if (activityBlockId) q = q.where("activityBlockId", "==", activityBlockId);

    const snap = await q.get();
    return { hazards: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyActivityHazard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.hazardId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyActivityHazards").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Riesgo no encontrado");
    return { hazard: { id: snap.id, ...snap.data() } };
  }
);

export const deleteSafetyActivityHazard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_activities.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("safetyActivityHazards").doc(id).delete();
    return { deleted: true };
  }
);
