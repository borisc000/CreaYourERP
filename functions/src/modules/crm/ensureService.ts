/**
 * Trigger: Cuando un Lead cambia a status='won', crear automáticamente
 * el registro canónico de Servicio y una orden de servicio operacional.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onLeadWon = onDocumentUpdated(
  {
    document: "companies/{companyId}/leads/{leadId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, leadId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Solo actuar si cambió a 'won'
    if (before.status === "won" || after.status !== "won") {
      return;
    }

    console.log(`[onLeadWon] Lead ${leadId} won in company ${companyId}`);

    try {
      // 1. Verificar si ya existe un servicio para este lead
      const existingServices = await db
        .collection("companies")
        .doc(companyId)
        .collection("crmServices")
        .where("leadId", "==", leadId)
        .limit(1)
        .get();

      if (!existingServices.empty) {
        console.log(`[onLeadWon] Service already exists for lead ${leadId}`);
        return;
      }

      // 2. Crear CRM Service
      const serviceCode = `SRV-${leadId.slice(-6).toUpperCase()}`;
      const serviceRef = db
        .collection("companies")
        .doc(companyId)
        .collection("crmServices")
        .doc();

      await serviceRef.set({
        companyId,
        leadId,
        customerId: after.customerId || null,
        mandanteId: after.mandanteId || null,
        serviceTypeId: after.serviceTypeId || null,
        serviceCode,
        title: after.title || "Servicio sin título",
        description: after.description || "",
        serviceName: after.serviceName || "",
        empresaFaena: after.empresaFaena || "",
        aprName: after.aprName || "",
        supervisorName: after.supervisorName || "",
        contractAdminName: after.contractAdminName || "",
        commercialStatus: "won",
        operationalStatus: "not_started",
        financialStatus: "pre_sale",
        mirrorEnabled: true,
        active: true,
        createdAt: new Date().toISOString(),
      });

      // 3. Crear ServiceOrder para operaciones
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

      // 4. Notificación
      await db.collection("companies").doc(companyId).collection("notifications").add({
        userId: after.assignedTo || after.createdBy || null,
        type: "lead.won",
        title: "¡Oportunidad ganada!",
        body: `"${after.title}" fue adjudicada. Se creó el servicio ${serviceCode} y la orden de servicio.`,
        data: { leadId, serviceId: serviceRef.id, serviceOrderId: orderRef.id },
        read: false,
        createdAt: new Date().toISOString(),
      });

      // 5. Activity log
      await db.collection("companies").doc(companyId).collection("activityLogs").add({
        companyId,
        leadId,
        type: "status_changed",
        message: `Oportunidad ganada. Servicio ${serviceCode} creado.`,
        userId: after.updatedBy || after.createdBy || null,
        metadata: { serviceId: serviceRef.id, serviceOrderId: orderRef.id, serviceCode },
        createdAt: new Date().toISOString(),
      });

      console.log(`[onLeadWon] Created service ${serviceRef.id} and serviceOrder ${orderRef.id}`);
    } catch (error) {
      console.error("[onLeadWon] Error:", error);
    }
  }
);
