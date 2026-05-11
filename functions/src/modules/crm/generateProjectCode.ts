/**
 * Trigger: Al crear un Lead, genera automáticamente un código de proyecto PRJ-XXXX.
 * Incrementa atomicamente el contador de la empresa.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onLeadCreated = onDocumentCreated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, leadId } = event.params;
    const data = event.data?.data();
    if (!data) return;

    // Si ya tiene projectCode, no hacer nada
    if (data.projectCode) return;

    try {
      const companyRef = db.collection("companies").doc(companyId);

      // Incrementar contador atómicamente
      const newSeq = await db.runTransaction(async (transaction) => {
        const companyDoc = await transaction.get(companyRef);
        const currentSeq = companyDoc.data()?.currentProjectSeq || 5000;
        const nextSeq = currentSeq + 1;
        transaction.update(companyRef, { currentProjectSeq: nextSeq });
        return nextSeq;
      });

      const projectCode = `PRJ-${newSeq.toString().padStart(4, "0")}`;

      await db
        .collection("companies")
        .doc(companyId)
        .collection("leads")
        .doc(leadId)
        .update({
          projectCode,
          updatedAt: new Date().toISOString(),
        });

      // Crear activity log de creación
      await db
        .collection("companies")
        .doc(companyId)
        .collection("activityLogs")
        .add({
          companyId,
          leadId,
          type: "created",
          message: `Oportunidad creada con código ${projectCode}`,
          userId: data.createdBy || null,
          metadata: { projectCode },
          createdAt: new Date().toISOString(),
        });

      console.log(`[onLeadCreated] Project code ${projectCode} assigned to lead ${leadId}`);
    } catch (error) {
      console.error("[onLeadCreated] Error:", error);
    }
  }
);
