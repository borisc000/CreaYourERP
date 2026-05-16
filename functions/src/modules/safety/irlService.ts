/**
 * Cloud Functions para IRL (Información de Riesgos Laborales)
 * - generateIRL: Genera un registro IRL desde la matriz MIPER de una carpeta
 * - saveIRL: Actualiza un registro IRL existente
 * - deleteIRL: Elimina un registro IRL
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ---------- generateIRL ----------
interface GenerateIRLPayload {
  folderId: string;
  employeeId?: string;
  positionTitle?: string;
}

export const generateIRL = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.generate_irl", { companyId });

    const { folderId, employeeId, positionTitle } = request.data as GenerateIRLPayload;
    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId es requerido");
    }
    if (!employeeId && !positionTitle) {
      throw new HttpsError("invalid-argument", "employeeId o positionTitle es requerido");
    }

    try {
      // 1. Fetch folder
      const folderSnap = await companyRef(companyId).collection("safetyFolders").doc(folderId).get();
      if (!folderSnap.exists) {
        throw new HttpsError("not-found", "Carpeta no encontrada");
      }
      const folder = folderSnap.data() || {};

      // 2. Fetch employee (optional)
      let employee: any = null;
      if (employeeId) {
        const empSnap = await companyRef(companyId).collection("employees").doc(employeeId).get();
        if (empSnap.exists) employee = empSnap.data();
      }

      // 3. Fetch matrix rows
      const matrixSnap = await companyRef(companyId)
        .collection("safetyRiskMatrices")
        .where("folderId", "==", folderId)
        .limit(1)
        .get();

      let riskItems: Array<{
        riskName: string;
        hazardName: string;
        preventiveMeasures: string;
        workMethod: string;
      }> = [];

      if (!matrixSnap.empty) {
        const matrixId = matrixSnap.docs[0].id;
        const rowsSnap = await companyRef(companyId)
          .collection("safetyRiskMatrices")
          .doc(matrixId)
          .collection("rows")
          .where("active", "==", true)
          .limit(12)
          .get();

        riskItems = rowsSnap.docs.map((d) => {
          const data = d.data();
          const measures = [
            ...(data.proposedEngineeringControls || []),
            ...(data.proposedAdminControls || []),
            ...(data.proposedPpeControls || []),
          ].join("; ") || data.safetyManagementPlan || data.existingControls || "";

          return {
            riskName: data.riskName || data.risk_name || "",
            hazardName: data.hazardName || data.hazard_name || "",
            preventiveMeasures: measures,
            workMethod: data.taskName || data.task_name || data.activityName || data.activity_name || "",
          };
        });
      }

      // 4. Build service functions from matrix rows
      const serviceFunctions = riskItems
        .map((r) => r.workMethod)
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .slice(0, 8);

      // 5. Build title
      const workerName = employee
        ? (employee.fullName || `${employee.firstName} ${employee.lastName}`)
        : (positionTitle || "Trabajador");
      const projectCode = folder.projectCode || folder.leadId?.slice(0, 8).toUpperCase() || "PRJ";
      const title = `IRL - ${workerName} - ${projectCode}`;

      // 6. Create IRL record
      const irlRef = companyRef(companyId).collection("safetyIRLRecords").doc();
      const now = new Date().toISOString();
      await irlRef.set({
        companyId,
        folderId,
        employeeId: employeeId || null,
        title,
        status: "draft",
        version: 1,
        workerName,
        workerIdentifier: employee?.cedula || employee?.employeeCode || "",
        positionTitle: employee?.positionTitle || positionTitle || "Operario",
        placeName: folder.clientAreaIds?.join(", ") || folder.clientSiteId || "",
        activityName: folder.notes?.slice(0, 120) || "",
        activityPeriod: folder.plannedStartDate || "",
        modality: "Presencial",
        durationHours: "08:00",
        executorName: "",
        workspaceFeatures: "",
        environmentalConditions: "",
        orderCleanliness: "",
        machinesTools: "",
        serviceFunctions,
        riskItems,
        complementMaterials: [],
        observations: "",
        introText: `Por medio de la presente se informa a usted, en cumplimiento de lo dispuesto en el artículo 14 del D.S. N° 44, sobre los riesgos laborales a que estará expuesto en el desarrollo de sus labores.`,
        themeColor: "#0F4C81",
        signedByEmployee: false,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        irlId: irlRef.id,
        riskItemCount: riskItems.length,
      };
    } catch (error: any) {
      console.error("[generateIRL] Error:", error);
      throw new HttpsError("internal", error.message || "Error al generar IRL");
    }
  }
);

// ---------- saveIRL ----------
interface SaveIRLPayload {
  irlId: string;
  title?: string;
  status?: string;
  workerIdentifier?: string;
  positionTitle?: string;
  placeName?: string;
  activityName?: string;
  activityPeriod?: string;
  modality?: string;
  durationHours?: string;
  executorName?: string;
  workspaceFeatures?: string;
  environmentalConditions?: string;
  orderCleanliness?: string;
  machinesTools?: string;
  serviceFunctions?: string[];
  riskItems?: Array<{
    riskName: string;
    hazardName?: string;
    preventiveMeasures?: string;
    workMethod?: string;
  }>;
  complementMaterials?: Array<{ name: string; type?: string; location?: string }>;
  observations?: string;
  introText?: string;
  themeColor?: string;
}

export const saveIRL = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.save_irl", { companyId });

    const { irlId, ...payload } = request.data as SaveIRLPayload;
    if (!irlId) {
      throw new HttpsError("invalid-argument", "irlId es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("safetyIRLRecords").doc(irlId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "IRL no encontrada");
      }

      const current = snap.data() || {};
      const newVersion = current.status !== payload.status && payload.status === "issued"
        ? (current.version || 1) + 1
        : (current.version || 1);

      await ref.update({
        ...payload,
        version: newVersion,
        updatedAt: new Date().toISOString(),
      });

      return { success: true, irlId };
    } catch (error: any) {
      console.error("[saveIRL] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar IRL");
    }
  }
);

// ---------- deleteIRL ----------
interface DeleteIRLPayload {
  irlId: string;
}

export const deleteIRL = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.delete_irl", { companyId });

    const { irlId } = request.data as DeleteIRLPayload;
    if (!irlId) {
      throw new HttpsError("invalid-argument", "irlId es requerido");
    }

    try {
      await companyRef(companyId).collection("safetyIRLRecords").doc(irlId).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteIRL] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar IRL");
    }
  }
);
