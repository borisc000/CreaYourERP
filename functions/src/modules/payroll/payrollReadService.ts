import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// PERIODS
// ==========================================

export const listPayrollPeriods = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const year = Number(data.year) || 0;
    const limit = Math.min(200, Math.max(1, Number(data.limit || 100)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("payrollPeriods").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (year) q = q.where("year", "==", year);

    const snap = await q.get();
    return { periods: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getPayrollPeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.periodId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollPeriods").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Período no encontrado");

    const settlementsSnap = await companyRef(companyId).collection("payrollSettlements").where("periodId", "==", id).get();
    return { period: { id: snap.id, ...snap.data() }, settlements: settlementsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deletePayrollPeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const settlementsSnap = await ref.collection("payrollSettlements").where("periodId", "==", id).limit(500).get();
    const batch = db.batch();
    for (const doc of settlementsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("payrollPeriods").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { settlements: settlementsSnap.size } };
  }
);

// ==========================================
// PROFILES
// ==========================================

export const listPayrollProfiles = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const data = request.data || {};
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    const snap = await companyRef(companyId).collection("payrollProfiles").orderBy("updatedAt", "desc").limit(limit).get();
    let profiles = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      profiles = profiles.filter((p: any) =>
        String(p.employeeName || "").toLowerCase().includes(search) ||
        String(p.employeeId || "").includes(search)
      );
    }
    return { profiles };
  }
);

export const getPayrollProfile = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.profileId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollProfiles").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Perfil no encontrado");
    return { profile: { id: snap.id, ...snap.data() } };
  }
);

export const deletePayrollProfile = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("payrollProfiles").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// SETTLEMENTS
// ==========================================

export const listSettlements = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const data = request.data || {};
    const periodId = cleanString(data.periodId);
    const employeeId = cleanString(data.employeeId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("payrollSettlements").orderBy("updatedAt", "desc").limit(limit);
    if (periodId) q = q.where("periodId", "==", periodId);
    if (employeeId) q = q.where("employeeId", "==", employeeId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { settlements: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getSettlement = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.settlementId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollSettlements").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    return { settlement: { id: snap.id, ...snap.data() } };
  }
);

export const updateSettlement = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollSettlements").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    const data = snap.data() || {};
    if (data.status === "closed" || data.status === "signed") {
      throw new HttpsError("failed-precondition", "No se puede editar una liquidación cerrada o firmada");
    }

    const { id: _, status: __, ...updateData } = request.data;
    await snap.ref.update({ ...updateData, updatedAt: nowIso() });

    // Log event
    await companyRef(companyId).collection("payrollEventLogs").add({
      companyId, settlementId: id, eventType: "updated",
      message: "Liquidación actualizada manualmente",
      userId: request.auth?.uid || "", createdAt: nowIso(),
    });

    return { updated: true };
  }
);

export const approveSettlement = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.approve", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollSettlements").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    const data = snap.data() || {};
    if (data.status !== "calculated" && data.status !== "draft") {
      throw new HttpsError("failed-precondition", "Solo liquidaciones calculadas pueden aprobarse");
    }

    await snap.ref.update({
      status: "approved", approvedBy: request.auth?.uid || "", approvedAt: nowIso(), updatedAt: nowIso(),
    });

    await companyRef(companyId).collection("payrollEventLogs").add({
      companyId, settlementId: id, eventType: "approved",
      message: "Liquidación aprobada", userId: request.auth?.uid || "", createdAt: nowIso(),
    });

    return { approved: true };
  }
);

export const closeSettlement = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.close", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("payrollSettlements").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    const data = snap.data() || {};
    if (data.status !== "approved" && data.status !== "signed") {
      throw new HttpsError("failed-precondition", "Solo liquidaciones aprobadas o firmadas pueden cerrarse");
    }

    await snap.ref.update({
      status: "closed", closedBy: request.auth?.uid || "", closedAt: nowIso(), updatedAt: nowIso(),
    });

    await companyRef(companyId).collection("payrollEventLogs").add({
      companyId, settlementId: id, eventType: "closed",
      message: "Liquidación cerrada", userId: request.auth?.uid || "", createdAt: nowIso(),
    });

    return { closed: true };
  }
);

export const getSettlementHistory = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });

    const settlementId = cleanString(request.data?.settlementId);
    if (!settlementId) throw new HttpsError("invalid-argument", "settlementId requerido");

    const snap = await companyRef(companyId).collection("payrollEventLogs").where("settlementId", "==", settlementId).orderBy("createdAt", "desc").limit(100).get();
    return { events: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

// ==========================================
// LEGAL PARAMETERS & TAX BRACKETS
// ==========================================

export const createLegalParameter = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const { code, name, category, valueNumeric, sourceLabel, effectiveFrom } = request.data;
    if (!code || !name) throw new HttpsError("invalid-argument", "code y name requeridos");

    const ref = await companyRef(companyId).collection("payrollLegalParameters").add({
      companyId, code, name, category: category || "general", valueNumeric: Number(valueNumeric) || 0,
      sourceLabel: sourceLabel || "", effectiveFrom: effectiveFrom || "2024-01-01",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateLegalParameter = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const { id: _, ...updateData } = request.data;
    if (updateData.valueNumeric !== undefined) updateData.valueNumeric = Number(updateData.valueNumeric);
    await companyRef(companyId).collection("payrollLegalParameters").doc(id).update({ ...updateData, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const deleteLegalParameter = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("payrollLegalParameters").doc(id).delete();
    return { deleted: true };
  }
);

export const createTaxBracket = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const { lowerUtm, upperUtm, factor, rebateUtm, orderIndex, effectiveFrom } = request.data;
    if (lowerUtm === undefined || factor === undefined) throw new HttpsError("invalid-argument", "lowerUtm y factor requeridos");

    const ref = await companyRef(companyId).collection("payrollTaxBrackets").add({
      companyId, lowerUtm: Number(lowerUtm), upperUtm: upperUtm !== undefined ? Number(upperUtm) : null,
      factor: Number(factor), rebateUtm: Number(rebateUtm) || 0,
      orderIndex: Number(orderIndex) || 0, effectiveFrom: effectiveFrom || "2024-01-01",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateTaxBracket = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const { id: _, ...updateData } = request.data;
    await companyRef(companyId).collection("payrollTaxBrackets").doc(id).update({ ...updateData, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const deleteTaxBracket = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("payrollTaxBrackets").doc(id).delete();
    return { deleted: true };
  }
);
