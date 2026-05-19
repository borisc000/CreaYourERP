/**
 * Trigger: Cuando una cotización es aceptada:
 * 1. Guardar controlSnapshot en la cotización
 * 2. Sincronizar CRM Service (ensure_service_for_lead)
 * 3. Avanzar lead a status='won' + stage order=6
 * 4. Crear ServiceOrder para operaciones
 * 5. Notificar y crear tarea
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onQuoteAccepted = onDocumentUpdated(
  {
    document: "companies/{companyId}/quotes/{quoteId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, quoteId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === "accepted" || after.status !== "accepted") return;

    console.log(`[onQuoteAccepted] Quote ${quoteId} accepted in company ${companyId}`);

    try {
      // 1. Guardar control snapshot en la cotización
      const controlSnapshot = {
        acceptedAt: new Date().toISOString(),
        acceptedBy: after.updatedBy || after.createdBy,
        grossTotal: after.grossTotal,
        netTotal: after.netTotal,
        quoteNumber: after.quoteNumber,
      };
      await db.collection("companies").doc(companyId).collection("quotes").doc(quoteId).update({
        controlSnapshot,
        controlMeta: {
          ...after.controlMeta,
          accepted: true,
          acceptedAt: new Date().toISOString(),
        },
      });

      // 2. Find or create CRM Service for the lead
      let serviceId: string | null = null;
      let serviceCode: string | null = null;
      if (after.leadId) {
        const serviceSnap = await db
          .collection("companies")
          .doc(companyId)
          .collection("crmServices")
          .where("leadId", "==", after.leadId)
          .limit(1)
          .get();

        if (!serviceSnap.empty) {
          const svc = serviceSnap.docs[0];
          serviceId = svc.id;
          serviceCode = svc.data().serviceCode;
          await svc.ref.update({
            commercialStatus: "won",
            acceptedQuoteId: quoteId,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 3. Update lead to 'won' and advance stage if exists
      if (after.leadId) {
        const leadRef = db.collection("companies").doc(companyId).collection("leads").doc(after.leadId);
        const leadUpdate: Record<string, any> = {
          status: "won",
          acceptedQuoteId: quoteId,
          updatedAt: new Date().toISOString(),
        };

        // Try to set stage to "Aceptada (Won)" (order 6)
        const stageSnap = await db
          .collection("companies")
          .doc(companyId)
          .collection("stages")
          .where("order", "==", 6)
          .limit(1)
          .get();
        if (!stageSnap.empty) {
          leadUpdate.stageId = stageSnap.docs[0].id;
        }

        await leadRef.update(leadUpdate);

        // Activity log
        await db.collection("companies").doc(companyId).collection("activityLogs").add({
          companyId,
          leadId: after.leadId,
          type: "status_changed",
          message: "Cotización aceptada. Oportunidad ganada.",
          userId: after.updatedBy || after.createdBy || null,
          metadata: { quoteId, serviceCode, serviceId },
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Create ServiceOrder
      const orderRef = db.collection("companies").doc(companyId).collection("serviceOrders").doc();
      await orderRef.set({
        companyId,
        quoteId,
        customerId: after.customerId || null,
        leadId: after.leadId || null,
        crmServiceId: serviceId,
        title: `OS: ${after.title || after.quoteNumber || quoteId}`,
        description: after.description || "",
        status: "active",
        requiredRequirementIds: after.requiredRequirementIds || [],
        requiredCourseIds: after.requiredCourseIds || [],
        startDate: after.validUntil || null,
        endDate: null,
        location: after.empresaFaena || "",
        riskLevel: "Medio",
        createdBy: after.createdBy,
        createdAt: new Date().toISOString(),
      });

      // 5. Notification
      await db.collection("companies").doc(companyId).collection("notifications").add({
        userId: after.createdBy,
        type: "quote.accepted",
        title: "Cotización aceptada",
        body: `Tu cotización "${after.title || after.quoteNumber}" fue aceptada. Se creó la orden de servicio ${orderRef.id}.`,
        data: { quoteId, serviceOrderId: orderRef.id, serviceId, serviceCode },
        read: false,
        createdAt: new Date().toISOString(),
      });

      // 6. Task
      await db.collection("companies").doc(companyId).collection("tasks").add({
        companyId,
        title: `Preparar faena: ${after.title || after.quoteNumber}`,
        description: "Asignar cuadrilla y verificar acreditaciones",
        relatedTo: "serviceOrder",
        relatedId: orderRef.id,
        assignedTo: after.createdBy,
        status: "pending",
        priority: "high",
        dueDate: after.validUntil || null,
        createdAt: new Date().toISOString(),
      });

      console.log(`[onQuoteAccepted] Created serviceOrder ${orderRef.id}, synced service ${serviceId}`);
    } catch (error) {
      console.error("[onQuoteAccepted] Error:", error);
    }
  }
);
