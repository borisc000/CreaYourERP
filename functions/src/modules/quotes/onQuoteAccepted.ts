/**
 * Trigger: Cuando una cotización es aceptada, crear automáticamente
 * una orden de servicio y notificar a las partes.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onQuoteAccepted = onDocumentUpdated(
  {
    document: "companies/{companyId}/quotes/{quoteId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, quoteId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Solo actuar si cambió a 'accepted'
    if (before.status === "accepted" || after.status !== "accepted") {
      return;
    }

    console.log(`[onQuoteAccepted] Quote ${quoteId} accepted in company ${companyId}`);

    try {
      // 1. Crear ServiceOrder
      const orderRef = db.collection("companies").doc(companyId).collection("serviceOrders").doc();
      await orderRef.set({
        companyId,
        quoteId,
        customerId: after.customerId || null,
        leadId: after.leadId || null,
        title: `OS: ${after.title}`,
        description: after.description || "",
        status: "active",
        requiredRequirementIds: after.requiredRequirementIds || [],
        requiredCourseIds: after.requiredCourseIds || [],
        startDate: after.validUntil || null,
        endDate: null,
        location: after.location || "",
        riskLevel: "Medio",
        createdBy: after.createdBy,
        createdAt: new Date().toISOString(),
      });

      // 2. Crear notificación para el creador de la cotización
      await db.collection("companies").doc(companyId).collection("notifications").add({
        userId: after.createdBy,
        type: "quote.accepted",
        title: "Cotización aceptada",
        body: `Tu cotización "${after.title}" fue aceptada. Se creó la orden de servicio ${orderRef.id}.`,
        data: { quoteId, serviceOrderId: orderRef.id },
        read: false,
        createdAt: new Date().toISOString(),
      });

      // 3. Crear tarea de onboarding para la orden
      await db.collection("companies").doc(companyId).collection("tasks").add({
        companyId,
        title: `Preparar faena: ${after.title}`,
        description: "Asignar cuadrilla y verificar acreditaciones",
        relatedTo: "serviceOrder",
        relatedId: orderRef.id,
        assignedTo: after.createdBy,
        status: "pending",
        priority: "high",
        dueDate: after.validUntil || null,
        createdAt: new Date().toISOString(),
      });

      console.log(`[onQuoteAccepted] Created serviceOrder ${orderRef.id}`);
    } catch (error) {
      console.error("[onQuoteAccepted] Error:", error);
    }
  }
);
