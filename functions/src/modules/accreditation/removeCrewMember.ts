import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  getCrewAssignment,
} from "./accreditationService";

export const removeCrewMember = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "accreditation.remove_crew", { companyId });

    const assignmentId = cleanString(request.data?.assignmentId);
    if (!assignmentId) {
      throw new HttpsError("invalid-argument", "assignmentId es obligatorio");
    }

    const assignment = await getCrewAssignment(companyId, assignmentId);
    if (!assignment) {
      throw new HttpsError("not-found", "Asignación no encontrada");
    }
    if (cleanString(assignment.companyId) && cleanString(assignment.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta asignación");
    }

    const now = new Date().toISOString();
    await db.runTransaction(async (t) => {
      t.update(companyRef(companyId).collection("crewAssignments").doc(assignmentId), {
        status: "removed",
        removedAt: now,
        removedBy: request.auth!.uid,
      });
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "crew.removed",
        serviceOrderId: assignment.serviceOrderId,
        employeeId: assignment.employeeId,
        message: "Empleado removido de cuadrilla",
        userId: request.auth!.uid,
        createdAt: now,
      });
    });

    return { id: assignmentId, status: "removed" };
  }
);
