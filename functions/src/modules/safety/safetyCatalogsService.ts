import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ===================== SafetyEquipmentBlock =====================
export const saveEquipmentBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_equipment", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const payload: any = {
      companyId,
      code: cleanString(data.code) || "",
      name: cleanString(data.name) || "",
      description: cleanString(data.description) || null,
      masterRiskIds: Array.isArray(data.masterRiskIds) ? data.masterRiskIds : [],
      controlHierarchy: data.controlHierarchy || null,
      requiredPpe: Array.isArray(data.requiredPpe) ? data.requiredPpe : [],
      protocolCodes: Array.isArray(data.protocolCodes) ? data.protocolCodes : [],
      probability: Number(data.probability) || 0,
      consequence: Number(data.consequence) || 0,
      isActive: data.isActive !== false,
      updatedAt: nowIso(),
    };

    if (id) {
      const ref = companyRef(companyId).collection("safetyEquipmentBlocks").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "No encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }
    const ref = companyRef(companyId).collection("safetyEquipmentBlocks").doc();
    await ref.set({ ...payload, createdAt: nowIso() });
    return { id: ref.id, created: true };
  }
);

export const deleteEquipmentBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_equipment", { companyId });
    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");
    await companyRef(companyId).collection("safetyEquipmentBlocks").doc(id).delete();
    return { deleted: true };
  }
);

// ===================== SafetyClientSite =====================
export const saveClientSite = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_sites", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const payload: any = {
      companyId,
      customerId: cleanString(data.customerId) || "",
      name: cleanString(data.name) || "",
      address: cleanString(data.address) || null,
      comuna: cleanString(data.comuna) || null,
      updatedAt: nowIso(),
    };

    if (id) {
      const ref = companyRef(companyId).collection("safetyClientSites").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "No encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }
    const ref = companyRef(companyId).collection("safetyClientSites").doc();
    await ref.set({ ...payload, createdAt: nowIso() });
    return { id: ref.id, created: true };
  }
);

export const deleteClientSite = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_sites", { companyId });
    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");
    await companyRef(companyId).collection("safetyClientSites").doc(id).delete();
    return { deleted: true };
  }
);

// ===================== SafetyClientArea =====================
export const saveClientArea = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_areas", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const payload: any = {
      companyId,
      siteId: cleanString(data.siteId) || "",
      parentAreaId: cleanString(data.parentAreaId) || null,
      name: cleanString(data.name) || "",
      riskNotes: cleanString(data.riskNotes) || null,
      updatedAt: nowIso(),
    };

    if (id) {
      const ref = companyRef(companyId).collection("safetyClientAreas").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "No encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }
    const ref = companyRef(companyId).collection("safetyClientAreas").doc();
    await ref.set({ ...payload, createdAt: nowIso() });
    return { id: ref.id, created: true };
  }
);

export const deleteClientArea = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_areas", { companyId });
    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");
    await companyRef(companyId).collection("safetyClientAreas").doc(id).delete();
    return { deleted: true };
  }
);

// ===================== SafetyWorkerRestriction =====================
export const saveWorkerRestriction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_restrictions", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const payload: any = {
      companyId,
      employeeId: cleanString(data.employeeId) || "",
      title: cleanString(data.title) || "",
      restrictionType: cleanString(data.restrictionType) || null,
      appliesToTags: Array.isArray(data.appliesToTags) ? data.appliesToTags : [],
      severity: ["info", "warning", "blocking"].includes(data.severity) ? data.severity : "warning",
      details: cleanString(data.details) || null,
      updatedAt: nowIso(),
    };

    if (id) {
      const ref = companyRef(companyId).collection("safetyWorkerRestrictions").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "No encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }
    const ref = companyRef(companyId).collection("safetyWorkerRestrictions").doc();
    await ref.set({ ...payload, createdAt: nowIso() });
    return { id: ref.id, created: true };
  }
);

export const deleteWorkerRestriction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_restrictions", { companyId });
    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");
    await companyRef(companyId).collection("safetyWorkerRestrictions").doc(id).delete();
    return { deleted: true };
  }
);

// ===================== SafetyGeneratorRule =====================
export const saveGeneratorRule = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_generator_rules", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const payload: any = {
      companyId,
      name: cleanString(data.name) || "",
      scopeType: ["transversal", "service_profile", "customer", "client_site", "client_area"].includes(data.scopeType) ? data.scopeType : "transversal",
      scopeRefId: cleanString(data.scopeRefId) || null,
      processName: cleanString(data.processName) || null,
      taskName: cleanString(data.taskName) || null,
      positionName: cleanString(data.positionName) || null,
      hazardFactor: cleanString(data.hazardFactor) || null,
      masterRiskId: cleanString(data.masterRiskId) || null,
      probability: Number(data.probability) || 0,
      consequence: Number(data.consequence) || 0,
      controlHierarchy: data.controlHierarchy || null,
      requiredPpe: Array.isArray(data.requiredPpe) ? data.requiredPpe : [],
      protocolCodes: Array.isArray(data.protocolCodes) ? data.protocolCodes : [],
      updatedAt: nowIso(),
    };

    if (id) {
      const ref = companyRef(companyId).collection("safetyGeneratorRules").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "No encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }
    const ref = companyRef(companyId).collection("safetyGeneratorRules").doc();
    await ref.set({ ...payload, createdAt: nowIso() });
    return { id: ref.id, created: true };
  }
);

export const deleteGeneratorRule = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.manage_generator_rules", { companyId });
    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");
    await companyRef(companyId).collection("safetyGeneratorRules").doc(id).delete();
    return { deleted: true };
  }
);
