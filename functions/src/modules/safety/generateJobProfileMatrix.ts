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

// Risk codes mapped by profile risk level
const RISK_CODES_BY_LEVEL: Record<string, string[]> = {
  low: ["A1", "A2", "A3", "B3", "B5", "O1", "O4", "P1", "P5", "P6", "P7", "P9", "D12"],
  medium: ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "F1", "O1", "O2", "O3", "O4", "P1", "P5", "P6", "P7", "P9", "Q2", "D6", "D12"],
  high: ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "B6", "F1", "F3", "I1", "J", "J2", "O1", "O2", "O3", "O4", "P1", "P5", "P6", "P7", "P9", "Q2", "R1", "S1", "T1", "T2", "D6", "D12", "N"],
  critical: ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "B6", "F1", "F3", "I1", "J", "J2", "O1", "O2", "O3", "O4", "P1", "P5", "P6", "P7", "P9", "Q2", "R1", "S1", "T1", "T2", "D1", "D6", "D12", "N"],
};

interface GeneratePayload {
  jobProfileId: string;
  safetyFolderId: string;
}

export const generateJobProfileMatrix = onCall(
  { region: "us-central1", cors, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.generate_risk_matrix", { companyId });

    const { jobProfileId, safetyFolderId } = request.data as GeneratePayload;
    if (!jobProfileId || !safetyFolderId) {
      throw new HttpsError("invalid-argument", "jobProfileId y safetyFolderId son requeridos");
    }

    try {
      // Fetch job profile
      const profileSnap = await companyRef(companyId).collection("jobProfiles").doc(jobProfileId).get();
      if (!profileSnap.exists) {
        throw new HttpsError("not-found", "Perfil de cargo no encontrado");
      }
      const profile = profileSnap.data() || {};
      const riskLevel = (profile.riskLevel || "low") as string;

      // Fetch active master risks
      const risksSnap = await companyRef(companyId)
        .collection("safetyMasterRisks")
        .where("isActive", "==", true)
        .get();
      const allRisks = risksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

      // Filter by risk level mapping
      const allowedCodes = new Set(RISK_CODES_BY_LEVEL[riskLevel] || RISK_CODES_BY_LEVEL.low);
      const relevantRisks = allRisks.filter((r) => allowedCodes.has(r.code));

      if (relevantRisks.length === 0) {
        throw new HttpsError("failed-precondition", "No hay riesgos maestros configurados para este perfil");
      }

      // Get or create matrix
      const matrixRef = companyRef(companyId).collection("safetyRiskMatrices").doc(safetyFolderId);
      const matrixSnap = await matrixRef.get();
      if (!matrixSnap.exists) {
        await matrixRef.set({
          companyId,
          safetyFolderId,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Write rows
      const batch = db.batch();
      const now = new Date().toISOString();
      let addedCount = 0;

      for (const risk of relevantRisks) {
        const rowRef = matrixRef.collection("rows").doc();
        const probability = risk.defaultProbability || 1;
        const consequence = risk.defaultConsequence || 1;
        const vep = probability * consequence;
        const compactMiper = vep; // simplified

        batch.set(rowRef, {
          companyId,
          safetyFolderId,
          matrixId: safetyFolderId,
          source: "job_profile",
          sourceId: jobProfileId,
          jobProfileName: profile.name || "",
          process: profile.name || "Perfil de cargo",
          task: "Tareas generales",
          position: profile.name || "",
          hazardCategory: risk.hazardCategory,
          hazardName: risk.hazardName,
          riskName: risk.riskName,
          probableDamage: risk.probableDamage || "",
          legalReference: risk.legalReference || "",
          pe: 1,
          fe: 1,
          fo: 1,
          severity: vep,
          residualProbability: probability,
          residualConsequence: consequence,
          residualRisk: compactMiper,
          proposedControls: [],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        addedCount++;
      }

      await batch.commit();

      return { success: true, addedCount, riskLevel };
    } catch (error: any) {
      console.error("[generateJobProfileMatrix] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error generando matriz");
    }
  }
);
