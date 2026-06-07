import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef, getEmployee } from "./hrService";

const VALID_CAUSES = new Set([
  "voluntary_resignation",
  "business_needs",
  "misconduct",
  "fixed_term_end",
  "mutual_agreement",
]);

export const saveTerminationRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.manage_terminations", { companyId });
    const uid = request.auth.uid;

    const data = request.data || {};
    const id = cleanString(data.id);
    const employeeId = cleanString(data.employeeId);
    if (!employeeId) throw new HttpsError("invalid-argument", "employeeId requerido");

    const employee = await getEmployee(companyId, employeeId);
    if (!employee) throw new HttpsError("not-found", "Empleado no encontrado");

    const terminationDate = cleanString(data.terminationDate);
    if (!terminationDate) throw new HttpsError("invalid-argument", "terminationDate requerido");

    const cause = cleanString(data.cause);
    if (cause && !VALID_CAUSES.has(cause)) {
      throw new HttpsError("invalid-argument", "Causa de término no válida");
    }

    const yearsOfService = Number(data.yearsOfService) || 0;
    const salary = Number(data.salary) || 0;
    const pendingVacationDays = Number(data.pendingVacationDays) || 0;

    // Simplified Chilean settlement calculation
    const severancePay = Math.round(yearsOfService * salary);
    const pendingVacationPay = Math.round((salary / 30) * pendingVacationDays);
    const proportionalBonus = Math.round(salary * 0.25);
    const otherSettlements = Number(data.otherSettlements) || 0;
    const totalSettlement = severancePay + pendingVacationPay + proportionalBonus + otherSettlements;

    const now = new Date().toISOString();
    const payload = {
      companyId,
      employeeId,
      terminationDate,
      noticeDate: cleanString(data.noticeDate) || null,
      cause: cause || "",
      reason: cleanString(data.reason) || "",
      noticePeriodDays: Number(data.noticePeriodDays) || 30,
      yearsOfService,
      salary,
      severancePay,
      pendingVacationPay,
      proportionalBonus,
      otherSettlements,
      totalSettlement,
      rehireEligible: data.rehireEligible === true,
      contractId: cleanString(data.contractId) || null,
      status: cleanString(data.status) || "draft",
      updatedAt: now,
    };

    const employeeRef = companyRef(companyId).collection("employees").doc(employeeId);

    // Find active contract for this employee
    const contractsSnap = await companyRef(companyId)
      .collection("contracts")
      .where("employeeId", "==", employeeId)
      .where("status", "in", ["active", "draft"])
      .limit(1)
      .get();

    const activeContract = contractsSnap.empty ? null : contractsSnap.docs[0];

    if (id) {
      const ref = companyRef(companyId).collection("terminationRecords").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Registro no encontrado");
      await ref.update(payload);
      return { id, updated: true };
    }

    const ref = companyRef(companyId).collection("terminationRecords").doc();

    await db.runTransaction(async (t) => {
      t.set(ref, { ...payload, createdAt: now });

      // Cascade: mark employee inactive
      t.update(employeeRef, {
        status: "inactive",
        terminationDate,
        updatedAt: now,
      });

      // Cascade: mark active contract terminated
      if (activeContract) {
        t.update(activeContract.ref, {
          status: "terminated",
          endDate: terminationDate,
          updatedAt: now,
        });
      }

      // EmploymentStatusEvent
      t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
        companyId,
        employeeId,
        eventType: "terminated",
        previousStatus: employee.status || "active",
        newStatus: "inactive",
        reason: payload.reason || `Desvinculación: ${cause || "no especificada"}`,
        effectiveDate: terminationDate,
        processedBy: uid,
        createdAt: now,
      });

      // Activity log
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "hr.termination.created",
        employeeId,
        terminationId: ref.id,
        message: `Desvinculación registrada para ${employee.fullName || employeeId}`,
        userId: uid,
        metadata: { cause: payload.cause, totalSettlement, contractId: activeContract?.id || null },
        createdAt: now,
      });
    });

    return { id: ref.id, created: true };
  }
);
