/**
 * Triggers CRM Service:
 * 1. onLeadWon: Crea CRMService + ServiceOrder cuando lead pasa a 'won'
 * 2. ensureServiceSync: Sincroniza CRMService cuando cambian campos del Lead
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

// Reusable: build service payload from lead data
function buildServicePayload(lead: any, existingService?: any) {
  const serviceCode =
    existingService?.serviceCode ||
    lead.projectCode ||
    `SRV-${lead.id?.slice(-6).toUpperCase() || "000000"}`;

  return {
    leadId: lead.id,
    companyId: lead.companyId,
    customerId: lead.customerId || null,
    mandanteId: lead.mandanteId || null,
    serviceTypeId: lead.serviceTypeId || null,
    acceptedQuoteId: existingService?.acceptedQuoteId || null,
    serviceCode,
    title: lead.title || "Servicio sin título",
    description: lead.description || "",
    serviceName: lead.serviceName || lead.title || "",
    empresaFaena: lead.empresaFaena || "",
    aprName: lead.aprName || "",
    supervisorName: lead.supervisorName || "",
    contractAdminName: lead.contractAdminName || "",
    commercialStatus:
      lead.status === "won"
        ? "won"
        : existingService?.commercialStatus || "intake",
    operationalStatus: existingService?.operationalStatus || "not_started",
    financialStatus: existingService?.financialStatus || "pre_sale",
    statusSnapshot: existingService?.statusSnapshot || {},
    contextSnapshot: {
      projectCode: lead.projectCode || "",
      serviceName: lead.serviceName || "",
      empresaFaena: lead.empresaFaena || "",
      aprName: lead.aprName || "",
      supervisorName: lead.supervisorName || "",
      contractAdminName: lead.contractAdminName || "",
      expectedRevenue: lead.expectedRevenue || 0,
    },
    operationalControl: existingService?.operationalControl || {},
    mirrorEnabled: existingService?.mirrorEnabled ?? true,
    active: existingService?.active ?? true,
  };
}

// Trigger 1: onLeadWon — create service + serviceOrder on first win
export const onLeadWon = onDocumentUpdated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, leadId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.status === "won" || after.status !== "won") return;

    console.log(`[onLeadWon] Lead ${leadId} won in company ${companyId}`);

    try {
      const existingSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("crmServices")
        .where("leadId", "==", leadId)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        console.log(`[onLeadWon] Service already exists for lead ${leadId}`);
        return;
      }

      const payload = buildServicePayload({ ...after, id: leadId });
      const serviceRef = db
        .collection("companies")
        .doc(companyId)
        .collection("crmServices")
        .doc();

      await serviceRef.set({
        ...payload,
        createdAt: new Date().toISOString(),
      });

      // Create ServiceOrder
      const orderRef = db.collection("companies").doc(companyId).collection("serviceOrders").doc();
      await orderRef.set({
        companyId,
        leadId,
        customerId: after.customerId || null,
        crmServiceId: serviceRef.id,
        title: after.title || "Orden de servicio",
        description: after.description || "",
        status: "active",
        requiredRequirementIds: [],
        requiredCourseIds: [],
        startDate: after.expectedCloseDate || null,
        endDate: null,
        location: after.empresaFaena || "",
        riskLevel: "Medio",
        createdAt: new Date().toISOString(),
      });

      // Notification
      await db.collection("companies").doc(companyId).collection("notifications").add({
        userId: after.assignedTo || after.createdBy || null,
        type: "lead.won",
        title: "¡Oportunidad ganada!",
        body: `"${after.title}" fue adjudicada. Se creó el servicio ${payload.serviceCode} y la orden de servicio.`,
        data: { leadId, serviceId: serviceRef.id, serviceOrderId: orderRef.id },
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Activity log
      await db.collection("companies").doc(companyId).collection("activityLogs").add({
        companyId,
        leadId,
        type: "status_changed",
        message: `Oportunidad ganada. Servicio ${payload.serviceCode} creado.`,
        userId: after.updatedBy || after.createdBy || null,
        metadata: { serviceId: serviceRef.id, serviceOrderId: orderRef.id, serviceCode: payload.serviceCode },
        createdAt: new Date().toISOString(),
      });

      console.log(`[onLeadWon] Created service ${serviceRef.id} and serviceOrder ${orderRef.id}`);
    } catch (error) {
      console.error("[onLeadWon] Error:", error);
    }
  }
);

// Trigger 2: ensureServiceSync — sync CRMService when lead fields change
export const ensureServiceSync = onDocumentUpdated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, leadId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only sync if relevant fields changed
    const relevantFields = [
      "title", "description", "customerId", "mandanteId", "serviceTypeId",
      "serviceName", "empresaFaena", "aprName", "supervisorName",
      "contractAdminName", "projectCode", "expectedRevenue",
    ];
    const hasRelevantChange = relevantFields.some((f) => before[f] !== after[f]);
    if (!hasRelevantChange) return;

    try {
      const snap = await db
        .collection("companies")
        .doc(companyId)
        .collection("crmServices")
        .where("leadId", "==", leadId)
        .limit(1)
        .get();

      const payload = buildServicePayload({ ...after, id: leadId }, snap.empty ? undefined : snap.docs[0].data());

      if (snap.empty) {
        // No service yet — create it (defensive)
        const ref = db.collection("companies").doc(companyId).collection("crmServices").doc();
        await ref.set({
          ...payload,
          createdAt: new Date().toISOString(),
        });
        console.log(`[ensureServiceSync] Created missing service for lead ${leadId}`);
      } else {
        // Update existing
        const doc = snap.docs[0];
        await doc.ref.update({
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[ensureServiceSync] Synced service ${doc.id} for lead ${leadId}`);
      }
    } catch (error) {
      console.error("[ensureServiceSync] Error:", error);
    }
  }
);
