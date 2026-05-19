import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef, getEmployee } from "./hrService";

export const approveTimeOffRequest = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.manage_contracts", { companyId });
    const uid = request.auth.uid;

    const id = cleanString(request.data?.id);
    const approved = request.data?.approved !== false;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId).collection("timeOffRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada");

    const requestData = snap.data()!;
    const employeeId = requestData.employeeId as string;
    const employee = await getEmployee(companyId, employeeId);

    const now = new Date().toISOString();
    const newStatus = approved ? "approved" : "rejected";

    await db.runTransaction(async (t) => {
      t.update(ref, {
        status: newStatus,
        approvedBy: uid,
        approvedAt: now,
        updatedAt: now,
      });

      // EmploymentStatusEvent for approved time off
      if (approved) {
        t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
          companyId,
          employeeId,
          eventType: "transferred",
          previousStatus: employee?.status || "active",
          newStatus: "on_leave",
          reason: `Licencia ${requestData.type}: ${requestData.daysRequested} días`,
          effectiveDate: requestData.startDate,
          processedBy: uid,
          createdAt: now,
        });
      }

      // Activity log
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: approved ? "hr.timeoff.approved" : "hr.timeoff.rejected",
        employeeId,
        timeOffRequestId: id,
        message: approved
          ? `Licencia aprobada: ${requestData.type} (${requestData.daysRequested} días)`
          : `Licencia rechazada: ${requestData.type}`,
        userId: uid,
        metadata: { type: requestData.type, daysRequested: requestData.daysRequested, startDate: requestData.startDate },
        createdAt: now,
      });
    });

    return { approved };
  }
);
