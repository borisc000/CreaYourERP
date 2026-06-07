import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// CHECKLISTS
// ==========================================

export const listSafetyChecklists = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const folderId = cleanString(data.folderId);
    const result = cleanString(data.result);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyChecklists").orderBy("updatedAt", "desc").limit(limit);
    if (folderId) q = q.where("folderId", "==", folderId);
    if (result) q = q.where("result", "==", result);

    const snap = await q.get();
    return { checklists: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyChecklist = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.checklistId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyChecklists").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Checklist no encontrado");
    return { checklist: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// IRL
// ==========================================

export const listSafetyIRLs = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const folderId = cleanString(data.folderId);
    const employeeId = cleanString(data.employeeId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyIRLs").orderBy("updatedAt", "desc").limit(limit);
    if (folderId) q = q.where("folderId", "==", folderId);
    if (employeeId) q = q.where("employeeId", "==", employeeId);

    const snap = await q.get();
    return { irls: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyIRL = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.irlId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyIRLs").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "IRL no encontrado");
    return { irl: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// PPE DELIVERIES
// ==========================================

export const listSafetyPPEDeliveries = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const folderId = cleanString(data.folderId);
    const employeeId = cleanString(data.employeeId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyPPEDeliveries").orderBy("updatedAt", "desc").limit(limit);
    if (folderId) q = q.where("folderId", "==", folderId);
    if (employeeId) q = q.where("employeeId", "==", employeeId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { deliveries: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyPPEDelivery = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.deliveryId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyPPEDeliveries").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Entrega de EPP no encontrada");
    return { delivery: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// TALKS
// ==========================================

export const listSafetyTalks = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const folderId = cleanString(data.folderId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyTalks").orderBy("updatedAt", "desc").limit(limit);
    if (folderId) q = q.where("folderId", "==", folderId);

    const snap = await q.get();
    return { talks: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSafetyTalk = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.talkId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyTalks").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Charla no encontrada");
    return { talk: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// CATALOGS (Equipment, Sites, Areas, Restrictions, Rules)
// ==========================================

export const listEquipmentBlocks = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const isActive = data.isActive;
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyEquipmentBlocks").orderBy("updatedAt", "desc").limit(limit);
    if (typeof isActive === "boolean") q = q.where("isActive", "==", isActive);

    const snap = await q.get();
    return { blocks: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getEquipmentBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.blockId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyEquipmentBlocks").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Bloque no encontrado");
    return { block: { id: snap.id, ...snap.data() } };
  }
);

export const listClientSites = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const limit = Math.min(500, Math.max(1, Number(request.data?.limit || 200)));
    const snap = await companyRef(companyId).collection("safetyClientSites").orderBy("updatedAt", "desc").limit(limit).get();
    return { sites: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getClientSite = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.siteId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyClientSites").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Sitio no encontrado");
    return { site: { id: snap.id, ...snap.data() } };
  }
);

export const listClientAreas = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const data = request.data || {};
    const siteId = cleanString(data.siteId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyClientAreas").orderBy("updatedAt", "desc").limit(limit);
    if (siteId) q = q.where("siteId", "==", siteId);

    const snap = await q.get();
    return { areas: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getClientArea = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.areaId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyClientAreas").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Área no encontrada");
    return { area: { id: snap.id, ...snap.data() } };
  }
);

export const listWorkerRestrictions = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const limit = Math.min(500, Math.max(1, Number(request.data?.limit || 200)));
    const snap = await companyRef(companyId).collection("safetyWorkerRestrictions").orderBy("updatedAt", "desc").limit(limit).get();
    return { restrictions: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getWorkerRestriction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.restrictionId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyWorkerRestrictions").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Restricción no encontrada");
    return { restriction: { id: snap.id, ...snap.data() } };
  }
);

export const listGeneratorRules = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const limit = Math.min(500, Math.max(1, Number(request.data?.limit || 200)));
    const snap = await companyRef(companyId).collection("safetyGeneratorRules").orderBy("updatedAt", "desc").limit(limit).get();
    return { rules: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getGeneratorRule = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.ruleId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyGeneratorRules").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Regla no encontrada");
    return { rule: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getSafetyReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.view", { companyId });

    const cref = companyRef(companyId);
    const [foldersSnap, employeesSnap] = await Promise.all([
      cref.collection("safetyFolders").orderBy("name").limit(100).get(),
      cref.collection("employees").orderBy("fullName").limit(200).get(),
    ]);

    return {
      checklistResults: [
        { code: "pending", name: "Pendiente" },
        { code: "ok", name: "OK" },
        { code: "critical", name: "Crítico" },
      ],
      ppeStatuses: [
        { code: "draft", name: "Borrador" },
        { code: "delivered", name: "Entregado" },
        { code: "replenishment", name: "Reposición" },
      ],
      folders: foldersSnap.docs.map((d) => ({ id: d.id, name: d.data().name || "" })),
      employees: employeesSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName || "" })),
    };
  }
);
