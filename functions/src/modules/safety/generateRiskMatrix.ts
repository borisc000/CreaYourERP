/**
 * Cloud Function: Genera o regenera la matriz MIPER para una carpeta de seguridad.
 *
 * Lógica:
 * 1. Lee la carpeta y su perfil de servicio
 * 2. Obtiene riesgos maestros activos
 * 3. Genera filas MIPER mapeando riesgos → actividades según el perfil
 * 4. Persiste filas como subcolección de safetyRiskMatrices
 * 5. Actualiza el documento matriz con generationSummary
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

interface GenerateMatrixPayload {
  folderId: string;
}

interface RiskRowInput {
  masterRiskId: string;
  hazardCategory: string;
  hazardName: string;
  riskName: string;
  probableDamage?: string;
  defaultProbability?: number;
  defaultConsequence?: number;
}

function generateRowsFromProfile(
  profile: any,
  masterRisks: RiskRowInput[],
  folder: any
): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  let sequence = 1;

  const profileName = profile?.name || "General";
  const riskLevel = profile?.riskLevel || "medium";

  // Map risk level to default task type
  const taskTypeMap: Record<string, string> = {
    low: "NR",
    medium: "NR",
    high: "R",
    critical: "R",
  };

  for (const risk of masterRisks) {
    const probability = risk.defaultProbability || 2;
    const consequence = risk.defaultConsequence || 2;
    const riskValue = probability * consequence; // VEP legacy

    // MIPER compacta calculation
    const pe = Math.min(probability, 3); // Exposed people
    const fe = Math.min(probability, 3); // Frequency
    const fo = Math.min(probability, 3); // Occurrence
    const probabilityScore = pe + fe + fo;
    const severity = Math.min(consequence, 4);
    const residualRiskValue = probabilityScore * severity;

    // Classify residual risk
    let residualRiskLabel = "Tolerable";
    let severityColor = "#10B981";
    let mitigationRequired = false;
    let approvalBlocked = false;

    if (residualRiskValue <= 4) {
      residualRiskLabel = "Tolerable";
      severityColor = "#10B981";
    } else if (residualRiskValue <= 8) {
      residualRiskLabel = "Moderado";
      severityColor = "#3B82F6";
      mitigationRequired = true;
    } else if (residualRiskValue <= 12) {
      residualRiskLabel = "Importante";
      severityColor = "#F59E0B";
      mitigationRequired = true;
    } else {
      residualRiskLabel = "Intolerable";
      severityColor = "#EF4444";
      mitigationRequired = true;
      approvalBlocked = true;
    }

    // Generate proposed controls based on risk category
    const proposedControls: Record<string, string[]> = {
      proposedEliminationControls: [],
      proposedSubstitutionControls: [],
      proposedEngineeringControls: [],
      proposedAdminControls: [],
      proposedPpeControls: [],
    };

    if (risk.hazardCategory === "Físico" && risk.hazardName.includes("Caída")) {
      proposedControls.proposedEngineeringControls = ["Barandas perimetrales", "Redes de seguridad", "Puntos de anclaje"];
      proposedControls.proposedAdminControls = ["Permiso de trabajo en altura", "Inspección previa"];
      proposedControls.proposedPpeControls = ["Arnés de seguridad", "Línea de vida", "Casco con barbiquejo"];
    } else if (risk.hazardCategory === "Químico") {
      proposedControls.proposedEngineeringControls = ["Ventilación forzada", "Monitoreo de gases"];
      proposedControls.proposedAdminControls = ["Permiso de ingreso", "Vigía permanente"];
      proposedControls.proposedPpeControls = ["Respirador", "Guantes químicos"];
    } else if (risk.hazardCategory === "Eléctrico") {
      proposedControls.proposedEngineeringControls = ["Bloqueo y etiquetado", "Tierra de protección"];
      proposedControls.proposedAdminControls = ["Permiso de trabajo eléctrico", "Solo personal autorizado"];
      proposedControls.proposedPpeControls = ["Guantes dieléctricos", "Arc flash suit"];
    } else if (risk.hazardCategory === "Mecánico") {
      proposedControls.proposedEngineeringControls = ["Guardas de protección", "Dispositivos de parada de emergencia"];
      proposedControls.proposedAdminControls = ["Procedimiento de bloqueo", "Señalética"];
      proposedControls.proposedPpeControls = ["Guantes anticorte", "Gafas de seguridad"];
    } else {
      proposedControls.proposedAdminControls = ["Procedimiento de trabajo seguro", "Capacitación"];
      proposedControls.proposedPpeControls = ["EPP estándar"];
    }

    rows.push({
      masterRiskId: risk.masterRiskId,
      sequence,
      activityName: profileName,
      taskName: `${profileName} - ${risk.hazardName}`,
      jobPosition: "Operario",
      specificWorkplace: folder?.empresaFaena || folder?.workCenter || "Faena",
      workerCount: 1,
      routineType: "Rutinaria",
      hazardName: risk.hazardName,
      riskName: risk.riskName,
      probableDamage: risk.probableDamage || "",
      probabilityValue: probability,
      consequenceValue: consequence,
      riskValue,
      riskLevelLabel: residualRiskLabel,
      taskTypeCode: taskTypeMap[riskLevel] || "NR",
      exposedPeopleValue: pe,
      exposureFrequencyValue: fe,
      occurrenceFactorValue: fo,
      probabilityScore,
      severityValue: severity,
      residualRiskValue,
      residualRiskLabel,
      currentEngineeringControls: "",
      currentAdminControls: "",
      currentPpeControls: "",
      ...proposedControls,
      safetyManagementPlan: `Controlar ${risk.hazardName.toLowerCase()} durante ${profileName.toLowerCase()}`,
      existingControls: "",
      requiredControls: proposedControls,
      ppeSummary: proposedControls.proposedPpeControls,
      protocolsSummary: proposedControls.proposedAdminControls,
      legalReference: "DS 594/1999 - Reglamento SSO",
      responsible: "Prevencionista",
      observations: `Generado automáticamente desde riesgo maestro ${risk.masterRiskId}`,
      originBlocks: ["master_risk"],
      sourceLabels: [risk.hazardCategory, risk.hazardName],
      sourceGroup: "master_risks",
      sourceTitle: risk.riskName,
      severityColor,
      approvalBlocked,
      mitigationRequired,
      active: true,
    });

    sequence++;
  }

  return rows;
}

export const generateRiskMatrix = onCall(
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

    await assertAction(request, "safety.generate_risk_matrix", { companyId });

    const { folderId } = request.data as GenerateMatrixPayload;
    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId es requerido");
    }

    try {
      // 1. Fetch folder
      const folderRef = db.collection("companies").doc(companyId).collection("safetyFolders").doc(folderId);
      const folderSnap = await folderRef.get();
      if (!folderSnap.exists) {
        throw new HttpsError("not-found", "Carpeta no encontrada");
      }
      const folder = folderSnap.data();

      // 2. Fetch service profile
      let profile: any = null;
      if (folder?.serviceProfileId) {
        const profileSnap = await db
          .collection("companies")
          .doc(companyId)
          .collection("safetyServiceProfiles")
          .doc(folder.serviceProfileId)
          .get();
        profile = profileSnap.data();
      }

      // 3. Fetch active master risks
      const risksSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("safetyMasterRisks")
        .where("isActive", "==", true)
        .get();

      const masterRisks: RiskRowInput[] = risksSnap.docs.map((d) => ({
        masterRiskId: d.id,
        ...d.data(),
      })) as RiskRowInput[];

      // 4. Generate rows
      const generatedRows = generateRowsFromProfile(profile, masterRisks, folder);

      // 5. Find or create risk matrix document
      const matricesRef = db.collection("companies").doc(companyId).collection("safetyRiskMatrices");
      const existingQuery = await matricesRef.where("folderId", "==", folderId).limit(1).get();

      let matrixRef;
      if (existingQuery.empty) {
        matrixRef = matricesRef.doc();
        await matrixRef.set({
          companyId,
          folderId,
          code: `MIPER-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
          title: `Matriz MIPER - ${folder?.leadTitle || folderId}`,
          status: "draft",
          version: 1,
          sourceType: "template",
          processName: profile?.name || "General",
          workCenter: folder?.empresaFaena || "",
          elaborationDate: new Date().toISOString().slice(0, 10),
          lastUpdateDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        });
      } else {
        matrixRef = existingQuery.docs[0].ref;
        await matrixRef.update({
          lastUpdateDate: new Date().toISOString().slice(0, 10),
          version: (existingQuery.docs[0].data().version || 1) + 1,
        });
      }

      // 6. Delete old rows and persist new ones
      const batch = db.batch();
      const oldRowsSnap = await matrixRef.collection("rows").get();
      oldRowsSnap.docs.forEach((d) => batch.delete(d.ref));

      for (const row of generatedRows) {
        const rowRef = matrixRef.collection("rows").doc();
        batch.set(rowRef, {
          companyId,
          riskMatrixId: matrixRef.id,
          ...row,
          createdAt: new Date().toISOString(),
        });
      }

      // 7. Update matrix summary
      const intolerableCount = generatedRows.filter((r) => r.approvalBlocked).length;
      const importantCount = generatedRows.filter((r) => r.mitigationRequired && !r.approvalBlocked).length;

      batch.update(matrixRef, {
        generationSummary: {
          generatedAt: new Date().toISOString(),
          sourceCount: masterRisks.length,
          sourceTypes: ["master_risks", "service_profile"],
          profileName: profile?.name || null,
          rowCount: generatedRows.length,
          intolerableCount,
          importantCount,
        },
        rows: generatedRows.map((r) => ({
          sequence: r.sequence,
          riskName: r.riskName,
          residualRiskValue: r.residualRiskValue,
          residualRiskLabel: r.residualRiskLabel,
          mitigationRequired: r.mitigationRequired,
        })),
      });

      await batch.commit();

      // 8. Trigger folder metrics refresh
      await folderRef.update({
        _refreshMetricsPending: true,
        updatedAt: new Date().toISOString(),
      });

      return {
        success: true,
        matrixId: matrixRef.id,
        rowCount: generatedRows.length,
        intolerableCount,
        importantCount,
      };
    } catch (error) {
      console.error("[generateRiskMatrix] Error:", error);
      throw new HttpsError("internal", "Error al generar matriz MIPER");
    }
  }
);
