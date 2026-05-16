import { onCall, HttpsError } from "firebase-functions/v2/https";
import { cors, cleanString, companyRef } from "./accreditationService";
import { checkCrewCompliance } from "./checkCrewCompliance";

export const recomputeChecks = onCall(
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
    if (!serviceOrderId) {
      throw new HttpsError("invalid-argument", "serviceOrderId es obligatorio");
    }

    // Verificar orden existe
    const orderDoc = await companyRef(companyId)
      .collection("serviceOrders")
      .doc(serviceOrderId)
      .get();

    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "Orden de servicio no encontrada");
    }

    // Obtener asignaciones activas para esta orden
    const assignmentsSnap = await companyRef(companyId)
      .collection("crewAssignments")
      .where("serviceOrderId", "==", serviceOrderId)
      .where("status", "in", ["assigned", "active"])
      .get();

    let checksComputed = 0;
    const errors: string[] = [];

    for (const doc of assignmentsSnap.docs) {
      const data = doc.data();
      try {
        await checkCrewCompliance(companyId, doc.id, {
          serviceOrderId: data.serviceOrderId,
          employeeId: data.employeeId,
          role: data.role || "worker",
        });
        checksComputed++;
      } catch (err: any) {
        errors.push(`Assignment ${doc.id}: ${err.message || "unknown error"}`);
        console.error(`[recomputeChecks] Error en assignment ${doc.id}:`, err);
      }
    }

    return {
      serviceOrderId,
      checksComputed,
      totalAssignments: assignmentsSnap.size,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
