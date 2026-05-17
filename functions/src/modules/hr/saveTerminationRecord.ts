import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

export const saveTerminationRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "hr.manage_contracts", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const employeeId = cleanString(data.employeeId);
    if (!employeeId) throw new HttpsError("invalid-argument", "employeeId requerido");

    const terminationDate = cleanString(data.terminationDate);
    if (!terminationDate) throw new HttpsError("invalid-argument", "terminationDate requerido");

    const yearsOfService = Number(data.yearsOfService) || 0;
    const salary = Number(data.salary) || 0;
    const pendingVacationDays = Number(data.pendingVacationDays) || 0;

    // Simplified Chilean settlement calculation
    const severancePay = Math.round(yearsOfService * salary);
    const pendingVacationPay = Math.round((salary / 30) * pendingVacationDays);
    const proportionalBonus = Math.round(salary * 0.25); // 25% of monthly salary as approximation
    const otherSettlements = Number(data.otherSettlements) || 0;
    const totalSettlement = severancePay + pendingVacationPay + proportionalBonus + otherSettlements;

    const now = new Date().toISOString();
    const payload = {
      companyId,
      employeeId,
      terminationDate,
      reason: cleanString(data.reason) || "",
      noticePeriodDays: Number(data.noticePeriodDays) || 30,
      yearsOfService,
      severancePay,
      pendingVacationPay,
      proportionalBonus,
      otherSettlements,
      totalSettlement,
      status: cleanString(data.status) || "draft",
      updatedAt: now,
    };

    if (id) {
      const ref = companyRef(companyId).collection("terminationRecords").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Registro no encontrado");
      await ref.update(payload);
      return { id, updated: true };
    } else {
      const ref = companyRef(companyId).collection("terminationRecords").doc();
      await ref.set({ ...payload, createdAt: now });
      return { id: ref.id, created: true };
    }
  }
);
