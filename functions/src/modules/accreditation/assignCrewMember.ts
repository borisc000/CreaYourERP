import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  companyRef,
  getServiceOrder,
} from "./accreditationService";

export const assignCrewMember = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const serviceOrderId = cleanString(request.data?.serviceOrderId);
    const employeeId = cleanString(request.data?.employeeId);
    const role = cleanString(request.data?.role) || "worker";

    if (!serviceOrderId) {
      throw new HttpsError("invalid-argument", "serviceOrderId es obligatorio");
    }
    if (!employeeId) {
      throw new HttpsError("invalid-argument", "employeeId es obligatorio");
    }

    // Verificar orden existe
    const order = await getServiceOrder(companyId, serviceOrderId);
    if (!order) {
      throw new HttpsError("not-found", "Orden de servicio no encontrada");
    }

    // Verificar que no esté ya asignado
    const existingSnap = await companyRef(companyId)
      .collection("crewAssignments")
      .where("serviceOrderId", "==", serviceOrderId)
      .where("employeeId", "==", employeeId)
      .where("status", "in", ["assigned", "active"])
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError("already-exists", "Este empleado ya está asignado a la cuadrilla");
    }

    const now = new Date().toISOString();
    const assignmentRef = companyRef(companyId).collection("crewAssignments").doc();
    const assignmentData = {
      companyId,
      serviceOrderId,
      employeeId,
      role,
      status: "assigned",
      authorizationStatus: "pending",
      assignedBy: request.auth.uid,
      assignedAt: now,
    };

    await db.runTransaction(async (t) => {
      t.set(assignmentRef, assignmentData);
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "crew.assigned",
        serviceOrderId,
        employeeId,
        message: `Empleado asignado a cuadrilla`,
        userId: request.auth!.uid,
        createdAt: now,
      });
    });

    return { id: assignmentRef.id, ...assignmentData };
  }
);
