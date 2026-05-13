import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

function calculateRisk(probability: number, consequence: number) {
  const value = probability * consequence;
  let label = "Bajo";
  if (value >= 20) label = "Crítico";
  else if (value >= 12) label = "Alto";
  else if (value >= 6) label = "Medio";
  return { value, label, blocked: value >= 12, mitigation: value >= 6 };
}

export const getActivityDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const [blocks, hazards] = await Promise.all([
      companyRef(companyId).collection("safetyActivityBlocks").get(),
      companyRef(companyId).collection("safetyActivityHazards").get(),
    ]);
    const blockList = blocks.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hazardList = hazards.docs.map((d) => ({ id: d.id, ...d.data() }));
    const critical = hazardList.filter((h: any) => (h.riskLevelValue || 0) >= 12).length;
    return {
      totalBlocks: blocks.size, activeBlocks: blockList.filter((b: any) => b.status === "active").length,
      totalHazards: hazards.size, criticalHazards: critical,
      blocks: blockList.slice(0, 20),
    };
  }
);

export const createActivityBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, ...data } = request.data;
    if (!data.name) throw new HttpsError("invalid-argument", "Datos incompletos");
    const count = (await companyRef(companyId).collection("safetyActivityBlocks").count().get()).data().count;
    const code = `BOT-${String(count + 1).padStart(4, "0")}`;
    const ref = await companyRef(companyId).collection("safetyActivityBlocks").add({
      companyId, code, name: data.name, description: data.description || "",
      blockType: data.blockType || "generic", originScope: data.originScope || "company",
      defaultProcessName: data.defaultProcessName || "", defaultTaskName: data.defaultTaskName || "",
      defaultOwnerName: data.defaultOwnerName || "", routineType: data.routineType || "routine",
      criticality: data.criticality || "medium", status: "active", version: "V1",
      tags: data.tags || [], active: true, createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id, code };
  }
);

export const updateActivityBlock = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    // Create version snapshot
    const block = await companyRef(companyId).collection("safetyActivityBlocks").doc(id).get();
    if (block.exists) {
      await companyRef(companyId).collection("safetyBlockVersions").add({
        companyId, blockId: id, blockCode: block.data()?.code, version: block.data()?.version || "V1",
        snapshot: block.data(), changeNote: data.changeNote || "", active: true, createdAt: nowIso(),
      });
    }
    await companyRef(companyId).collection("safetyActivityBlocks").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const createActivityHazard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, activityBlockId, ...data } = request.data;
    if (!activityBlockId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const risk = calculateRisk(data.probability || 1, data.consequence || 1);
    const ref = await companyRef(companyId).collection("safetyActivityHazards").add({
      companyId, activityBlockId, hazardFactor: data.hazardFactor || "",
      hazardDescriptionContextual: data.hazardDescriptionContextual || "",
      riskDescriptionContextual: data.riskDescriptionContextual || "",
      probability: data.probability || 1, consequence: data.consequence || 1,
      riskLevelValue: risk.value, riskLevelLabel: risk.label,
      approvalBlocked: risk.blocked, mitigationRequired: risk.mitigation,
      currentControls: data.currentControls || "", proposedControls: data.proposedControls || "",
      requiredPpe: data.requiredPpe || [], protocolCodes: data.protocolCodes || [],
      legalReference: data.legalReference || "", displayOrder: data.displayOrder || 0,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id, risk };
  }
);

export const updateActivityHazard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const update: any = { ...data, updatedAt: nowIso() };
    if (data.probability && data.consequence) {
      const risk = calculateRisk(data.probability, data.consequence);
      update.riskLevelValue = risk.value;
      update.riskLevelLabel = risk.label;
      update.approvalBlocked = risk.blocked;
      update.mitigationRequired = risk.mitigation;
    }
    await companyRef(companyId).collection("safetyActivityHazards").doc(id).update(update);
    return { updated: true };
  }
);
