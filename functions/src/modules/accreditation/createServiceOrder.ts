import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  validateServiceOrderInput,
} from "./accreditationService";

export const createServiceOrder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "accreditation.create_service_order", { companyId });

    const data = request.data || {};

    const validationError = validateServiceOrderInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const now = new Date().toISOString();
    const orderRef = companyRef(companyId).collection("serviceOrders").doc();
    const orderData = {
      companyId,
      title: cleanString(data.title),
      description: cleanString(data.description) || null,
      leadId: cleanString(data.leadId),
      customerId: cleanString(data.customerId) || null,
      status: "active",
      requiredRequirementIds: Array.isArray(data.requiredRequirementIds) ? data.requiredRequirementIds : [],
      requiredCourseIds: Array.isArray(data.requiredCourseIds) ? data.requiredCourseIds : [],
      startDate: cleanString(data.startDate) || null,
      endDate: cleanString(data.endDate) || null,
      location: cleanString(data.location) || null,
      riskLevel: cleanString(data.riskLevel) || "Medio",
      createdBy: request.auth.uid,
      createdAt: now,
      updatedAt: now,
    };

    await db.runTransaction(async (t) => {
      t.set(orderRef, orderData);
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "serviceOrder.created",
        serviceOrderId: orderRef.id,
        message: `Orden de servicio ${orderData.title} creada`,
        userId: request.auth!.uid,
        createdAt: now,
      });
    });

    return { id: orderRef.id, ...orderData };
  }
);
