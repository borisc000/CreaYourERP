/**
 * Trigger: Al actualizar un Lead, genera automáticamente registros de actividad
 * cuando cambian campos relevantes.
 *
 * Detecta cambios en: status, priority, stage, customer, mandante, assignedTo,
 * expectedRevenue, probability, title, description, poNumber, reportNumber,
 * hesNumber, invoiceNumber, isPaid, serviceName, empresaFaena, aprName,
 * supervisorName, contractAdminName, visitDate, quoteDeadline, source, serviceTypeId.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  expectedRevenue: "Ingresos esperados",
  probability: "Probabilidad",
  priority: "Prioridad",
  assignedTo: "Asignado a",
  customerId: "Cliente",
  mandanteId: "Contacto",
  stageId: "Etapa",
  serviceTypeId: "Tipo de servicio",
  poNumber: "OC",
  reportNumber: "N° reporte",
  hesNumber: "HES",
  invoiceNumber: "Factura",
  isPaid: "Pago",
  serviceName: "Servicio",
  empresaFaena: "Empresa/Faena",
  aprName: "APR",
  supervisorName: "Supervisor",
  contractAdminName: "ADM contrato",
  visitDate: "Fecha visita terreno",
  quoteDeadline: "Fecha límite cotización",
  source: "Origen",
  reportAreaId: "Área",
  reportSectorId: "Sector",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const onLeadUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "southamerica-west1",
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

    // 1. Cambio de estado
    if (before.status !== after.status) {
      logs.push({
        type: "status_changed",
        message: `Estado cambiado a: ${STATUS_LABELS[after.status] || after.status}`,
        metadata: { from: before.status, to: after.status },
      });
    }

    // 2. Cambio de etapa
    if (before.stageId !== after.stageId) {
      logs.push({
        type: "stage_changed",
        message: "Etapa del pipeline actualizada",
        metadata: { from: before.stageId, to: after.stageId },
      });
    }

    // 3. Cambio de prioridad
    if (before.priority !== after.priority) {
      logs.push({
        type: "updated",
        message: `Prioridad cambiada a: ${PRIORITY_LABELS[after.priority] || after.priority}`,
        metadata: { from: before.priority, to: after.priority },
      });
    }

    // 4. Cambio de cliente
    if (before.customerId !== after.customerId) {
      logs.push({
        type: "updated",
        message: "Cliente vinculado actualizado",
        metadata: { from: before.customerId, to: after.customerId },
      });
    }

    // 5. Cambio de contacto (mandante)
    if (before.mandanteId !== after.mandanteId) {
      logs.push({
        type: "updated",
        message: "Contacto actualizado",
        metadata: { from: before.mandanteId, to: after.mandanteId },
      });
    }

    // 6. Cambio de asignación
    if (before.assignedTo !== after.assignedTo) {
      logs.push({
        type: "updated",
        message: "Asignación actualizada",
        metadata: { from: before.assignedTo, to: after.assignedTo },
      });
    }

    // 7. Cambio de tipo de servicio
    if (before.serviceTypeId !== after.serviceTypeId) {
      logs.push({
        type: "updated",
        message: "Tipo de servicio actualizado",
        metadata: { from: before.serviceTypeId, to: after.serviceTypeId },
      });
    }

    // 8. Cambio de ingreso esperado
    if (before.expectedRevenue !== after.expectedRevenue) {
      logs.push({
        type: "updated",
        message: `Ingreso esperado actualizado: $${after.expectedRevenue?.toLocaleString("es-CL")}`,
        metadata: { from: before.expectedRevenue, to: after.expectedRevenue },
      });
    }

    // 9. Cambio de probabilidad
    if (before.probability !== after.probability) {
      logs.push({
        type: "updated",
        message: `Probabilidad actualizada: ${after.probability}%`,
        metadata: { from: before.probability, to: after.probability },
      });
    }

    // 10. Detectar cambios en todos los demás campos trackeables
    const trackedFields = [
      "title",
      "description",
      "poNumber",
      "reportNumber",
      "hesNumber",
      "invoiceNumber",
      "isPaid",
      "serviceName",
      "empresaFaena",
      "aprName",
      "supervisorName",
      "contractAdminName",
      "visitDate",
      "quoteDeadline",
      "source",
      "reportAreaId",
      "reportSectorId",
    ];

    for (const field of trackedFields) {
      if (before[field] !== after[field]) {
        const label = FIELD_LABELS[field] || field;
        logs.push({
          type: "updated",
          message: `${label} actualizado`,
          metadata: { field, from: before[field], to: after[field] },
        });
      }
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
