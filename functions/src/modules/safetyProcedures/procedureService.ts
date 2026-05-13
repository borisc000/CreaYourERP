import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getProcedureDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const snap = await companyRef(companyId).collection("safetyProcedureTemplates").get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      total: docs.length,
      byStatus: {
        draft: docs.filter((d: any) => d.status === "draft").length,
        review: docs.filter((d: any) => d.status === "review").length,
        active: docs.filter((d: any) => d.status === "active").length,
        approved: docs.filter((d: any) => d.status === "approved").length,
        archived: docs.filter((d: any) => d.status === "archived").length,
      },
      procedures: docs,
    };
  }
);

export const createProcedure = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, ...data } = request.data;
    if (!data.name) throw new HttpsError("invalid-argument", "Datos incompletos");
    const count = (await companyRef(companyId).collection("safetyProcedureTemplates").count().get()).data().count;
    const code = `PTS-${String(count + 1).padStart(4, "0")}`;
    const ref = await companyRef(companyId).collection("safetyProcedureTemplates").add({
      companyId, procedureCode: code, name: data.name, version: "V1", status: "draft",
      serviceProfileId: data.serviceProfileId || "", projectId: data.projectId || "",
      workCenter: data.workCenter || "", objective: data.objective || "",
      scope: data.scope || "", responsibilities: data.responsibilities || "",
      activityDescription: data.activityDescription || "", requiredPpe: data.requiredPpe || [],
      toolsAndEquipment: data.toolsAndEquipment || [], workforceRoles: data.workforceRoles || [],
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id, code };
  }
);

export const updateProcedure = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const approveProcedure = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const proc = await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).get();
    if (!proc.exists) throw new HttpsError("not-found", "Procedimiento no encontrado");

    // Create version snapshot
    await companyRef(companyId).collection("safetyProcedureVersions").add({
      companyId, procedureId: id, procedureCode: proc.data()?.procedureCode,
      version: proc.data()?.version || "V1", status: "approved",
      snapshot: proc.data(), approvedBy: request.auth?.uid || "", approvedAt: nowIso(), active: true,
    });

    await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).update({
      status: "approved", approvedBy: request.auth?.uid || "", approvedAt: nowIso(), updatedAt: nowIso(),
    });
    return { approved: true };
  }
);

export const createProcedureStep = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, procedureId, ...data } = request.data;
    if (!procedureId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("safetyProcedureSteps").add({
      companyId, procedureId, phaseName: data.phaseName || "setup", stepTitle: data.stepTitle || "",
      stepDescription: data.stepDescription || "", processName: data.processName || "",
      taskName: data.taskName || "", positionName: data.positionName || "", ownerName: data.ownerName || "",
      displayOrder: data.displayOrder || 0, isRequired: true, isConditional: false,
      active: true, createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateProcedureStep = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("safetyProcedureSteps").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);
