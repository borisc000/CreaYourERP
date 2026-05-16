import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  cors,
  cleanString,
  companyRef,
  validateServiceOrderInput,
  getServiceOrder,
} from "./accreditationService";

export const updateServiceOrder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const orderId = cleanString(request.data?.id || request.data?.orderId);
    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId es obligatorio");
    }

    const data = request.data || {};

    const order = await getServiceOrder(companyId, orderId);
    if (!order) {
      throw new HttpsError("not-found", "Orden de servicio no encontrada");
    }
    if (cleanString(order.companyId) && cleanString(order.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta orden de servicio");
    }

    const validationError = validateServiceOrderInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: request.auth.uid,
    };

    if (data.title !== undefined) updateData.title = cleanString(data.title);
    if (data.description !== undefined) updateData.description = cleanString(data.description) || null;
    if (data.leadId !== undefined) updateData.leadId = cleanString(data.leadId);
    if (data.customerId !== undefined) updateData.customerId = cleanString(data.customerId) || null;
    if (data.requiredRequirementIds !== undefined) updateData.requiredRequirementIds = Array.isArray(data.requiredRequirementIds) ? data.requiredRequirementIds : [];
    if (data.requiredCourseIds !== undefined) updateData.requiredCourseIds = Array.isArray(data.requiredCourseIds) ? data.requiredCourseIds : [];
    if (data.startDate !== undefined) updateData.startDate = cleanString(data.startDate) || null;
    if (data.endDate !== undefined) updateData.endDate = cleanString(data.endDate) || null;
    if (data.location !== undefined) updateData.location = cleanString(data.location) || null;
    if (data.riskLevel !== undefined) updateData.riskLevel = cleanString(data.riskLevel) || "Medio";

    await companyRef(companyId).collection("serviceOrders").doc(orderId).update(updateData);

    return { id: orderId, updated: true };
  }
);
