/**
 * Trigger: Al actualizar un Lead, genera automáticamente registros de actividad
 * cuando cambian campos relevantes (stage, status, asignación, etc.).
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onLeadUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, leadId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const logs: Array<{
      type: string;
      message: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // Detectar cambio de estado
    if (before.status !== after.status) {
      const statusLabels: Record<string, string> = {
        open: "Abierta",
        won: "Ganada",
        lost: "Perdida",
      };
      logs.push({
        type: "status_changed",
        message: `Estado cambiado a: ${statusLabels[after.status] || after.status}`,
        metadata: { from: before.status, to: after.status },
      });
    }

    // Detectar cambio de prioridad
    if (before.priority !== after.priority) {
      const priorityLabels: Record<string, string> = {
        low: "Baja",
        medium: "Media",
        high: "Alta",
      };
      logs.push({
        type: "updated",
        message: `Prioridad cambiada a: ${priorityLabels[after.priority] || after.priority}`,
        metadata: { from: before.priority, to: after.priority },
      });
    }

    // Detectar cambio de cliente
    if (before.customerId !== after.customerId) {
      logs.push({
        type: "updated",
        message: "Cliente vinculado actualizado",
        metadata: { from: before.customerId, to: after.customerId },
      });
    }

    // Detectar cambio de asignación
    if (before.assignedTo !== after.assignedTo) {
      logs.push({
        type: "updated",
        message: "Asignación actualizada",
        metadata: { from: before.assignedTo, to: after.assignedTo },
      });
    }

    // Detectar cambio de ingreso esperado
    if (before.expectedRevenue !== after.expectedRevenue) {
      logs.push({
        type: "updated",
        message: `Ingreso esperado actualizado: $${after.expectedRevenue?.toLocaleString("es-CL")}`,
        metadata: { from: before.expectedRevenue, to: after.expectedRevenue },
      });
    }

    // Detectar cambio de probabilidad
    if (before.probability !== after.probability) {
      logs.push({
        type: "updated",
        message: `Probabilidad actualizada: ${after.probability}%`,
        metadata: { from: before.probability, to: after.probability },
      });
    }

    if (logs.length === 0) return;

    try {
      const batch = db.batch();
      const logsRef = db.collection("companies").doc(companyId).collection("activityLogs");

      for (const log of logs) {
        const ref = logsRef.doc();
        batch.set(ref, {
          companyId,
          leadId,
          ...log,
          userId: after.updatedBy || after.createdBy || null,
          createdAt: new Date().toISOString(),
        });
      }

      await batch.commit();
      console.log(`[onLeadUpdated] ${logs.length} activity logs created for lead ${leadId}`);
    } catch (error) {
      console.error("[onLeadUpdated] Error:", error);
    }
  }
);
