/**
 * Generate a personalized job-profile risk matrix for an employee.
 * Combines employee data + job profile risks + risk links into matrix rows.
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

export const getEmployeeJobProfileMatrix = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.view_contracts", { companyId });

    const { employeeId } = request.data as { employeeId: string };
    if (!employeeId) throw new HttpsError("invalid-argument", "employeeId es requerido");

    const empRef = companyRef(companyId).collection("employees").doc(employeeId);
    const empSnap = await empRef.get();
    if (!empSnap.exists) throw new HttpsError("not-found", "Empleado no encontrado");
    const employee = empSnap.data() || {};

    const profileId = employee.jobProfileId;
    if (!profileId) {
      return {
        employee: { id: employeeId, ...employee },
        profile: null,
        matrixRows: [],
        message: "El empleado no tiene un perfil de cargo asignado",
      };
    }

    const profileRef = companyRef(companyId).collection("jobProfiles").doc(profileId);
    const [profileSnap, risksSnap, riskLinksSnap] = await Promise.all([
      profileRef.get(),
      profileRef.collection("risks").where("active", "==", true).orderBy("displayOrder").get(),
      profileRef.collection("riskLinks").where("active", "==", true).orderBy("displayOrder").get(),
    ]);

    const profile = profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null;
    const risks: any[] = risksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const riskLinks: any[] = riskLinksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Build matrix rows combining risks + risk links
    const matrixRows: any[] = [];

    for (const risk of risks) {
      matrixRows.push({
        type: "profile_risk",
        sourceId: risk.id,
        processName: risk.processName || "",
        taskName: risk.taskName || "",
        hazardFactor: risk.hazardFactor || "",
        riskName: risk.riskName || "",
        consequence: risk.consequence || "",
        controlsSummary: risk.controlsSummary || "",
        requiredPpe: risk.requiredPpe || [],
        protocolCodes: risk.protocolCodes || [],
        probability: risk.probability || 1,
        severity: risk.severity || 1,
        vep: risk.vep || 4,
        riskLevelLabel: risk.riskLevelLabel || "bajo",
        ownerName: risk.ownerName || "",
        masterRiskCode: risk.masterRiskCode || "",
      });
    }

    for (const link of riskLinks) {
      matrixRows.push({
        type: "master_risk_link",
        sourceId: link.id,
        processName: "",
        taskName: "",
        hazardFactor: link.hazardCategory || "",
        riskName: link.riskName || "",
        consequence: "",
        controlsSummary: "",
        requiredPpe: [],
        protocolCodes: [],
        probability: 1,
        severity: 1,
        vep: 4,
        riskLevelLabel: "bajo",
        ownerName: "",
        masterRiskCode: link.masterRiskCode || "",
      });
    }

    return {
      employee: { id: employeeId, ...employee },
      profile,
      matrixRows,
      totalRows: matrixRows.length,
    };
  }
);

/**
 * Generate matrices for multiple employees at once.
 */
export const getBulkEmployeeJobProfileMatrices = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "hr.view_contracts", { companyId });

    const { employeeIds } = request.data as { employeeIds: string[] };
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new HttpsError("invalid-argument", "employeeIds debe ser un array no vacío");
    }
    if (employeeIds.length > 50) {
      throw new HttpsError("invalid-argument", "Máximo 50 empleados por llamada");
    }

    const results: Record<string, any> = {};

    for (const empId of employeeIds) {
      const empSnap = await companyRef(companyId).collection("employees").doc(empId).get();
      if (!empSnap.exists) {
        results[empId] = { error: "Empleado no encontrado" };
        continue;
      }
      const employee = empSnap.data() || {};
      const profileId = employee.jobProfileId;

      if (!profileId) {
        results[empId] = {
          employee: { id: empId, ...employee },
          profile: null,
          matrixRows: [],
        };
        continue;
      }

      const profileRef = companyRef(companyId).collection("jobProfiles").doc(profileId);
      const [risksSnap, riskLinksSnap] = await Promise.all([
        profileRef.collection("risks").where("active", "==", true).orderBy("displayOrder").get(),
        profileRef.collection("riskLinks").where("active", "==", true).orderBy("displayOrder").get(),
      ]);

      const matrixRows: any[] = [];
      for (const d of risksSnap.docs) {
        const r = d.data() as any;
        matrixRows.push({ type: "profile_risk", sourceId: d.id, taskName: r.taskName, hazardFactor: r.hazardFactor, riskName: r.riskName, consequence: r.consequence, controlsSummary: r.controlsSummary, requiredPpe: r.requiredPpe || [], protocolCodes: r.protocolCodes || [], vep: r.vep || 4, riskLevelLabel: r.riskLevelLabel || "bajo" });
      }
      for (const d of riskLinksSnap.docs) {
        const r = d.data() as any;
        matrixRows.push({ type: "master_risk_link", sourceId: d.id, hazardFactor: r.hazardCategory, riskName: r.riskName, vep: 4, riskLevelLabel: "bajo", masterRiskCode: r.masterRiskCode || "" });
      }

      results[empId] = {
        employee: { id: empId, fullName: employee.fullName, positionTitle: employee.positionTitle, jobProfileId: profileId },
        profile: { id: profileId, name: (await profileRef.get()).data()?.name || "" },
        matrixRows,
        totalRows: matrixRows.length,
      };
    }

    return { results, total: employeeIds.length };
  }
);
