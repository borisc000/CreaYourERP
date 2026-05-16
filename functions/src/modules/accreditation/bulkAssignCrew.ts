import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef, getServiceOrder } from "./accreditationService";
import { checkCrewCompliance } from "./checkCrewCompliance";

export const bulkAssignCrew = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "accreditation.assign_crew", { companyId });

    const serviceOrderId = cleanString(request.data?.serviceOrderId);
    const assignments = request.data?.assignments;

    if (!serviceOrderId) {
      throw new HttpsError("invalid-argument", "serviceOrderId es obligatorio");
    }
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new HttpsError("invalid-argument", "assignments debe ser un array no vacío");
    }

    // Verificar orden existe
    const order = await getServiceOrder(companyId, serviceOrderId);
    if (!order) {
      throw new HttpsError("not-found", "Orden de servicio no encontrada");
    }

    // Obtener asignaciones existentes para detectar duplicados
    const existingSnap = await companyRef(companyId)
      .collection("crewAssignments")
      .where("serviceOrderId", "==", serviceOrderId)
      .where("status", "in", ["assigned", "active"])
      .get();

    const existingEmployeeIds = new Set(existingSnap.docs.map((d) => d.data().employeeId));

    const now = new Date().toISOString();
    const results: Array<{ id: string; employeeId: string; status: string }> = [];
    const createdAssignments: Array<{ id: string; employeeId: string; role: string }> = [];

    await db.runTransaction(async (t) => {
      for (const item of assignments) {
        const employeeId = cleanString(item.employeeId);
        const role = cleanString(item.role) || "worker";

        if (!employeeId) {
          results.push({ id: "", employeeId: "", status: "invalid_employee" });
          continue;
        }

        if (existingEmployeeIds.has(employeeId)) {
          results.push({ id: "", employeeId, status: "already_assigned" });
          continue;
        }

        const assignmentRef = companyRef(companyId).collection("crewAssignments").doc();
        const assignmentData = {
          companyId,
          serviceOrderId,
          employeeId,
          role,
          status: "assigned",
          authorizationStatus: "pending",
          assignedBy: request.auth!.uid,
          assignedAt: now,
        };

        t.set(assignmentRef, assignmentData);
        t.set(companyRef(companyId).collection("activityLogs").doc(), {
          companyId,
          type: "crew.assigned",
          serviceOrderId,
          employeeId,
          message: `Empleado asignado a cuadrilla (bulk)`,
          userId: request.auth!.uid,
          createdAt: now,
        });

        results.push({ id: assignmentRef.id, employeeId, status: "assigned" });
        createdAssignments.push({ id: assignmentRef.id, employeeId, role });
        existingEmployeeIds.add(employeeId);
      }
    });

    // Post-transacción: compliance check para cada asignación creada
    for (const created of createdAssignments) {
      try {
        await checkCrewCompliance(companyId, created.id, {
          serviceOrderId,
          employeeId: created.employeeId,
          role: created.role,
        });
      } catch (err: any) {
        console.error(`[bulkAssignCrew] Compliance check falló para ${created.employeeId}:`, err);
      }
    }

    return {
      serviceOrderId,
      results,
      assignedCount: createdAssignments.length,
      skippedCount: results.length - createdAssignments.length,
    };
  }
);
