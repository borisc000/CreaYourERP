import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { cors, companyRef } from "./accreditationService";

export interface ExpiringDocument {
  accreditationId: string;
  employeeId: string;
  employeeName?: string;
  requirementId: string;
  requirementName?: string;
  documentUrl?: string;
  validUntil: string;
  daysRemaining: number;
  serviceOrderIds: string[];
}

export const checkExpiringDocuments = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const daysAhead = Math.min(Math.max(Number(request.data?.daysAhead) || 30, 1), 365);
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Buscar acreditaciones válidas que vencen en el rango
    const accSnap = await db
      .collectionGroup("accreditations")
      .where("companyId", "==", companyId)
      .where("status", "==", "valid")
      .where("validUntil", ">=", today)
      .where("validUntil", "<=", futureDate)
      .get();

    const results: ExpiringDocument[] = [];
    const employeeIds = new Set<string>();
    const requirementIds = new Set<string>();

    for (const doc of accSnap.docs) {
      const data = doc.data();
      const validUntil = data.validUntil as string;
      const daysRemaining = Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      results.push({
        accreditationId: doc.id,
        employeeId: data.employeeId,
        requirementId: data.referenceId,
        documentUrl: data.documentUrl,
        validUntil,
        daysRemaining,
        serviceOrderIds: [],
      });

      employeeIds.add(data.employeeId);
      requirementIds.add(data.referenceId);
    }

    if (results.length === 0) {
      return { expiring: [], total: 0, daysAhead };
    }

    // Enriquecer con nombres de empleados y requisitos
    const employeeMap = new Map<string, string>();
    const reqMap = new Map<string, string>();

    // Leer empleados (batch en grupos de 10 por limitación de Firestore 'in')
    const empIdArray = Array.from(employeeIds);
    for (let i = 0; i < empIdArray.length; i += 10) {
      const batch = empIdArray.slice(i, i + 10);
      const snap = await companyRef(companyId)
        .collection("employees")
        .where("__name__", "in", batch)
        .get();
      snap.forEach((d) => {
        const data = d.data();
        employeeMap.set(d.id, data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Desconocido");
      });
    }

    // Leer requisitos
    const reqIdArray = Array.from(requirementIds);
    for (let i = 0; i < reqIdArray.length; i += 10) {
      const batch = reqIdArray.slice(i, i + 10);
      const snap = await companyRef(companyId)
        .collection("accreditationRequirements")
        .where("__name__", "in", batch)
        .get();
      snap.forEach((d) => {
        reqMap.set(d.id, d.data().name || "Requisito desconocido");
      });
    }

    // Buscar órdenes de servicio donde están asignados estos empleados
    for (const r of results) {
      const assignmentsSnap = await companyRef(companyId)
        .collection("crewAssignments")
        .where("employeeId", "==", r.employeeId)
        .where("status", "in", ["assigned", "active"])
        .get();
      r.serviceOrderIds = assignmentsSnap.docs.map((d) => d.data().serviceOrderId);
      r.employeeName = employeeMap.get(r.employeeId);
      r.requirementName = reqMap.get(r.requirementId);
    }

    return {
      expiring: results,
      total: results.length,
      daysAhead,
    };
  }
);
