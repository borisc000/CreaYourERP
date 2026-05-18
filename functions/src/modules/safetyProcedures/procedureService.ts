import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
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
    await assertAction(request, "safety_procedures.view", { companyId });
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
    await assertAction(request, "safety_procedures.create", { companyId });
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
    await assertAction(request, "safety_procedures.edit", { companyId });
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");

    const proc = await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).get();
    if (!proc.exists) throw new HttpsError("not-found", "Procedimiento no encontrado");
    if (proc.data()?.status === "approved") {
      throw new HttpsError("failed-precondition", "No se puede editar un procedimiento aprobado. Cree una nueva versión o clone.");
    }

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
    await assertAction(request, "safety_procedures.edit", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");

    const proc = await companyRef(companyId).collection("safetyProcedureTemplates").doc(id).get();
    if (!proc.exists) throw new HttpsError("not-found", "Procedimiento no encontrado");
    const procData = proc.data()!;

    // Read all steps
    const stepsSnap = await companyRef(companyId).collection("safetyProcedureSteps").where("procedureId", "==", id).get();
    const stepSnapshots = stepsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Compute next version
    const currentVersion = procData.version || "V1";
    let nextVersion = "V2";
    const match = currentVersion.match(/V(\d+)/);
    if (match) {
      nextVersion = `V${String(parseInt(match[1], 10) + 1)}`;
    }

    const now = nowIso();

    await db.runTransaction(async (t) => {
      // Deactivate previous versions
      const prevVersions = await companyRef(companyId).collection("safetyProcedureVersions").where("procedureId", "==", id).get();
      for (const v of prevVersions.docs) {
        t.update(v.ref, { active: false, updatedAt: now });
      }

      // Create new version snapshot
      const versionRef = companyRef(companyId).collection("safetyProcedureVersions").doc();
      t.set(versionRef, {
        companyId,
        procedureId: id,
        procedureCode: procData.procedureCode,
        version: nextVersion,
        status: "approved",
        snapshot: procData,
        stepSnapshots,
        approvedBy: request.auth?.uid || "",
        approvedAt: now,
        active: true,
        createdAt: now,
      });

      // Update template
      t.update(companyRef(companyId).collection("safetyProcedureTemplates").doc(id), {
        status: "approved",
        version: nextVersion,
        approvedBy: request.auth?.uid || "",
        approvedAt: now,
        updatedAt: now,
      });
    });

    return { approved: true, version: nextVersion };
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
    await assertAction(request, "safety_procedures.create", { companyId });
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
    await assertAction(request, "safety_procedures.edit", { companyId });
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");

    const step = await companyRef(companyId).collection("safetyProcedureSteps").doc(id).get();
    if (!step.exists) throw new HttpsError("not-found", "Paso no encontrado");
    const procedureId = step.data()?.procedureId;
    if (procedureId) {
      const proc = await companyRef(companyId).collection("safetyProcedureTemplates").doc(procedureId).get();
      if (proc.exists && proc.data()?.status === "approved") {
        throw new HttpsError("failed-precondition", "No se puede editar pasos de un procedimiento aprobado.");
      }
    }

    await companyRef(companyId).collection("safetyProcedureSteps").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);
