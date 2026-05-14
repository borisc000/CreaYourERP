/**
 * Cloud Function: Recalcula readinessPct y trafficLight de una carpeta de seguridad.
 *
 * Criterios:
 * - 20%: Matriz MIPER aprobada y sin riesgos intolerables
 * - 20%: Documentos críticos aprobados
 * - 20%: Personal asignado
 * - 20%: EPP entregado
 * - 20%: Checklists conformes
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const refreshFolderMetrics = onDocumentUpdated(
  {
    document: "companies/{companyId}/safetyFolders/{folderId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, folderId } = event.params;
    const after = event.data?.after.data();

    if (!after) return;
    // Skip if not flagged for refresh
    if (!after._refreshMetricsPending) return;

    try {
      let readiness = 0;
      const checks: Record<string, boolean> = {};

      // 1. Check matrix status (20%)
      const matrixSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("safetyRiskMatrices")
        .where("folderId", "==", folderId)
        .limit(1)
        .get();

      if (!matrixSnap.empty) {
        const matrix = matrixSnap.docs[0].data();
        const summary = matrix.generationSummary || {};
        const hasIntolerable = (summary.intolerableCount || 0) > 0;
        const isApproved = matrix.status === "approved";
        checks.matrix = isApproved && !hasIntolerable;
        if (isApproved && !hasIntolerable) readiness += 20;
        else if (!hasIntolerable) readiness += 10; // Has matrix but not approved
      }

      // 2. Check critical documents (20%)
      const docsSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("safetyFolderDocuments")
        .where("folderId", "==", folderId)
        .get();

      const allDocs = docsSnap.docs.map((d) => d.data());
      const criticalDocs = allDocs.filter((d) => d.isCritical);
      const approvedCritical = criticalDocs.filter((d) => d.status === "approved").length;
      checks.documents = criticalDocs.length > 0 && approvedCritical === criticalDocs.length;
      if (checks.documents) readiness += 20;
      else if (criticalDocs.length > 0) readiness += Math.round((approvedCritical / criticalDocs.length) * 20);

      // 3. Check assigned personnel (20%)
      const assignedCount = (after.assignedEmployeeIds || []).length;
      checks.personnel = assignedCount > 0;
      if (checks.personnel) readiness += 20;

      // 4. Check PPE deliveries (20%)
      const ppeSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("safetyPPEDeliveries")
        .where("folderId", "==", folderId)
        .where("status", "==", "delivered")
        .get();
      checks.ppe = !ppeSnap.empty;
      if (checks.ppe) readiness += 20;

      // 5. Check checklists (20%)
      const checklistSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("safetyChecklistRuns")
        .where("folderId", "==", folderId)
        .where("status", "==", "conform")
        .get();
      checks.checklists = !checklistSnap.empty;
      if (checks.checklists) readiness += 20;

      // Determine traffic light
      let trafficLight: "red" | "yellow" | "green" = "red";
      if (readiness >= 80 && !checks.matrix) {
        trafficLight = "yellow"; // Almost ready but matrix issues
      } else if (readiness >= 80) {
        trafficLight = "green";
      } else if (readiness >= 40) {
        trafficLight = "yellow";
      }

      // Override to red if intolerable risks exist
      const matrixData = matrixSnap?.docs?.[0]?.data();
      if (matrixData?.generationSummary?.intolerableCount > 0) {
        trafficLight = "red";
      }

      await event.data!.after.ref.update({
        readinessPct: readiness,
        trafficLight,
        _refreshMetricsPending: false,
        _lastMetricsCheck: {
          timestamp: new Date().toISOString(),
          checks,
          readiness,
        },
      });

      console.log(`[refreshFolderMetrics] Folder ${folderId}: ${readiness}% (${trafficLight})`);
    } catch (error) {
      console.error("[refreshFolderMetrics] Error:", error);
    }
  }
);
