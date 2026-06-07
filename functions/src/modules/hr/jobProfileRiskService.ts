/**
 * Job Profile Risk & RiskLink management
 * - saveJobProfileRisk / deleteJobProfileRisk
 * - saveJobProfileRiskLink / deleteJobProfileRiskLink
 * - getJobProfileComplete
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// MIPER helpers
// ==========================================

function computeVep(probability: number, severity: number): number {
  const p = Math.max(1, Math.min(5, Number(probability) || 1));
  const s = Math.max(1, Math.min(5, Number(severity) || 1));
  return p * s * 4;
}

function riskLabelFromVep(vep: number): string {
  if (vep >= 48) return "crítico";
  if (vep >= 32) return "alto";
  if (vep >= 16) return "medio";
  return "bajo";
}

// ==========================================
// saveJobProfileRisk
// ==========================================

interface SaveRiskPayload {
  profileId: string;
  id?: string;
  processName?: string;
  taskName: string;
  hazardFactor: string;
  riskName: string;
  consequence?: string;
  controlsSummary?: string;
  requiredPpe?: string[];
  protocolCodes?: string[];
  masterRiskCode?: string;
  probability?: number;
  severity?: number;
  ownerName?: string;
  sourceNote?: string;
  displayOrder?: number;
  active?: boolean;
}

export const saveJobProfileRisk = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.manage_job_profile_risks", { companyId });

    const payload = request.data as SaveRiskPayload;
    if (!payload.profileId) throw new HttpsError("invalid-argument", "profileId es requerido");
    if (!payload.taskName?.trim()) throw new HttpsError("invalid-argument", "taskName es requerido");
    if (!payload.hazardFactor?.trim()) throw new HttpsError("invalid-argument", "hazardFactor es requerido");
    if (!payload.riskName?.trim()) throw new HttpsError("invalid-argument", "riskName es requerido");

    const profileRef = companyRef(companyId).collection("jobProfiles").doc(payload.profileId);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) throw new HttpsError("not-found", "Perfil no encontrado");

    const vep = computeVep(payload.probability || 1, payload.severity || 1);
    const riskLevelLabel = riskLabelFromVep(vep);
    const now = nowIso();

    const data = {
      profileId: payload.profileId,
      companyId,
      processName: payload.processName?.trim() || "",
      taskName: payload.taskName.trim(),
      hazardFactor: payload.hazardFactor.trim(),
      riskName: payload.riskName.trim(),
      consequence: payload.consequence?.trim() || "",
      controlsSummary: payload.controlsSummary?.trim() || "",
      requiredPpe: Array.isArray(payload.requiredPpe) ? payload.requiredPpe.filter(Boolean) : [],
      protocolCodes: Array.isArray(payload.protocolCodes) ? payload.protocolCodes.filter(Boolean) : [],
      masterRiskCode: payload.masterRiskCode?.trim() || "",
      probability: Math.max(1, Math.min(5, Number(payload.probability) || 1)),
      severity: Math.max(1, Math.min(5, Number(payload.severity) || 1)),
      vep,
      riskLevelLabel,
      ownerName: payload.ownerName?.trim() || "",
      sourceNote: payload.sourceNote?.trim() || "",
      displayOrder: Number(payload.displayOrder) || 0,
      active: payload.active !== false,
      updatedAt: now,
    };

    if (payload.id) {
      const ref = profileRef.collection("risks").doc(payload.id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Riesgo no encontrado");
      await ref.update(data);
      return { success: true, id: payload.id, updated: true };
    } else {
      const ref = profileRef.collection("risks").doc();
      await ref.set({ ...data, createdAt: now });
      return { success: true, id: ref.id, created: true };
    }
  }
);

// ==========================================
// deleteJobProfileRisk
// ==========================================

export const deleteJobProfileRisk = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.manage_job_profile_risks", { companyId });

    const { profileId, id } = request.data as { profileId: string; id: string };
    if (!profileId || !id) throw new HttpsError("invalid-argument", "profileId e id son requeridos");

    await companyRef(companyId).collection("jobProfiles").doc(profileId).collection("risks").doc(id).delete();
    return { success: true };
  }
);

// ==========================================
// saveJobProfileRiskLink
// ==========================================

interface SaveRiskLinkPayload {
  profileId: string;
  id?: string;
  masterRiskId: string;
  displayOrder?: number;
  active?: boolean;
}

export const saveJobProfileRiskLink = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.manage_job_profile_risks", { companyId });

    const payload = request.data as SaveRiskLinkPayload;
    if (!payload.profileId || !payload.masterRiskId) {
      throw new HttpsError("invalid-argument", "profileId y masterRiskId son requeridos");
    }

    const profileRef = companyRef(companyId).collection("jobProfiles").doc(payload.profileId);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) throw new HttpsError("not-found", "Perfil no encontrado");

    // Validate master risk exists
    const masterSnap = await companyRef(companyId).collection("safetyMasterRisks").doc(payload.masterRiskId).get();
    if (!masterSnap.exists) throw new HttpsError("not-found", "Riesgo maestro no encontrado");
    const master = masterSnap.data() || {};

    const now = nowIso();
    const data = {
      profileId: payload.profileId,
      companyId,
      masterRiskId: payload.masterRiskId,
      masterRiskCode: master.code || "",
      hazardCategory: master.hazardCategory || "",
      hazardName: master.hazardName || "",
      riskName: master.riskName || "",
      displayOrder: Number(payload.displayOrder) || 0,
      active: payload.active !== false,
      updatedAt: now,
    };

    if (payload.id) {
      const ref = profileRef.collection("riskLinks").doc(payload.id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Vínculo no encontrado");
      await ref.update(data);
      return { success: true, id: payload.id, updated: true };
    } else {
      const ref = profileRef.collection("riskLinks").doc();
      await ref.set({ ...data, createdAt: now });
      return { success: true, id: ref.id, created: true };
    }
  }
);

// ==========================================
// deleteJobProfileRiskLink
// ==========================================

export const deleteJobProfileRiskLink = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.manage_job_profile_risks", { companyId });

    const { profileId, id } = request.data as { profileId: string; id: string };
    if (!profileId || !id) throw new HttpsError("invalid-argument", "profileId e id son requeridos");

    await companyRef(companyId).collection("jobProfiles").doc(profileId).collection("riskLinks").doc(id).delete();
    return { success: true };
  }
);

// ==========================================
// getJobProfileComplete
// ==========================================

export const getJobProfileComplete = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.view_contracts", { companyId });

    const { profileId } = request.data as { profileId: string };
    if (!profileId) throw new HttpsError("invalid-argument", "profileId es requerido");

    const profileRef = companyRef(companyId).collection("jobProfiles").doc(profileId);

    const [profileSnap, risksSnap, riskLinksSnap, employeesSnap] = await Promise.all([
      profileRef.get(),
      profileRef.collection("risks").where("active", "==", true).orderBy("displayOrder").get(),
      profileRef.collection("riskLinks").where("active", "==", true).orderBy("displayOrder").get(),
      companyRef(companyId).collection("employees").where("jobProfileId", "==", profileId).limit(100).get(),
    ]);

    if (!profileSnap.exists) throw new HttpsError("not-found", "Perfil no encontrado");

    const profile = { id: profileSnap.id, ...profileSnap.data() };
    const risks = risksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const riskLinks = riskLinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const employees = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return {
      success: true,
      profile,
      risks,
      riskLinks,
      employees,
    };
  }
);
