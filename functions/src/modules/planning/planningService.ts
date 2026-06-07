import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
];

function nowIso() {
  return new Date().toISOString();
}

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ==========================================
// getPlanningDashboard
// ==========================================

function sumMonthlyAmounts(amounts: Record<string, number> | undefined): number {
  return Object.values(amounts || {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
}

export const getPlanningDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });
    const { year } = request.data;

    const cref = companyRef(companyId);
    const targetYear = year || new Date().getFullYear();

    const [budgetsSnap, linesSnap] = await Promise.all([
      cref.collection("planningBudgets").where("year", "==", targetYear).get(),
      cref.collection("planningBudgetLines").limit(500).get(),
    ]);

    const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
    const lines = linesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const activeBudget = budgets.find((b: any) => b.status === "active");
    const budgetIds = new Set(budgets.map((b: any) => b.id));
    const budgetLines = lines.filter((l: any) => budgetIds.has(l.budgetId));

    // Initialize monthly aggregates
    const monthlyPlanInflow: Record<string, number> = {};
    const monthlyPlanOutflow: Record<string, number> = {};
    const monthlyActualInflow: Record<string, number> = {};
    const monthlyActualOutflow: Record<string, number> = {};
    const monthlyCommittedInflow: Record<string, number> = {};
    const monthlyCommittedOutflow: Record<string, number> = {};
    const monthlyForecastInflow: Record<string, number> = {};
    const monthlyForecastOutflow: Record<string, number> = {};

    for (let m = 1; m <= 12; m++) {
      const key = String(m);
      monthlyPlanInflow[key] = 0;
      monthlyPlanOutflow[key] = 0;
      monthlyActualInflow[key] = 0;
      monthlyActualOutflow[key] = 0;
      monthlyCommittedInflow[key] = 0;
      monthlyCommittedOutflow[key] = 0;
      monthlyForecastInflow[key] = 0;
      monthlyForecastOutflow[key] = 0;
    }

    let totalPlanInflow = 0;
    let totalPlanOutflow = 0;
    let totalActualInflow = 0;
    let totalActualOutflow = 0;
    let totalCommittedInflow = 0;
    let totalCommittedOutflow = 0;
    let totalForecastInflow = 0;
    let totalForecastOutflow = 0;

    budgetLines.forEach((line: any) => {
      const isInflow = line.lineType === "inflow";

      // Planned
      Object.entries(line.plannedAmounts || {}).forEach(([month, amount]) => {
        const num = typeof amount === "number" ? amount : 0;
        if (isInflow) {
          monthlyPlanInflow[month] = (monthlyPlanInflow[month] || 0) + num;
          totalPlanInflow += num;
        } else {
          monthlyPlanOutflow[month] = (monthlyPlanOutflow[month] || 0) + num;
          totalPlanOutflow += num;
        }
      });

      // Actual
      Object.entries(line.actualAmounts || {}).forEach(([month, amount]) => {
        const num = typeof amount === "number" ? amount : 0;
        if (isInflow) {
          monthlyActualInflow[month] = (monthlyActualInflow[month] || 0) + num;
          totalActualInflow += num;
        } else {
          monthlyActualOutflow[month] = (monthlyActualOutflow[month] || 0) + num;
          totalActualOutflow += num;
        }
      });

      // Committed
      Object.entries(line.committedAmounts || {}).forEach(([month, amount]) => {
        const num = typeof amount === "number" ? amount : 0;
        if (isInflow) {
          monthlyCommittedInflow[month] = (monthlyCommittedInflow[month] || 0) + num;
          totalCommittedInflow += num;
        } else {
          monthlyCommittedOutflow[month] = (monthlyCommittedOutflow[month] || 0) + num;
          totalCommittedOutflow += num;
        }
      });

      // Forecast
      Object.entries(line.forecastAmounts || {}).forEach(([month, amount]) => {
        const num = typeof amount === "number" ? amount : 0;
        if (isInflow) {
          monthlyForecastInflow[month] = (monthlyForecastInflow[month] || 0) + num;
          totalForecastInflow += num;
        } else {
          monthlyForecastOutflow[month] = (monthlyForecastOutflow[month] || 0) + num;
          totalForecastOutflow += num;
        }
      });
    });

    const openingCash = activeBudget?.openingCash || 0;
    const projectedClosing = openingCash + totalForecastInflow - totalForecastOutflow;

    // Monthly comparison: plan vs actual vs committed vs forecast
    const monthlyComparison: Record<string, any> = {};
    for (let m = 1; m <= 12; m++) {
      const key = String(m);
      const planNet = (monthlyPlanInflow[key] || 0) - (monthlyPlanOutflow[key] || 0);
      const actualNet = (monthlyActualInflow[key] || 0) - (monthlyActualOutflow[key] || 0);
      const committedNet = (monthlyCommittedInflow[key] || 0) - (monthlyCommittedOutflow[key] || 0);
      const forecastNet = (monthlyForecastInflow[key] || 0) - (monthlyForecastOutflow[key] || 0);
      monthlyComparison[key] = {
        planInflow: monthlyPlanInflow[key] || 0,
        planOutflow: monthlyPlanOutflow[key] || 0,
        planNet,
        actualInflow: monthlyActualInflow[key] || 0,
        actualOutflow: monthlyActualOutflow[key] || 0,
        actualNet,
        committedInflow: monthlyCommittedInflow[key] || 0,
        committedOutflow: monthlyCommittedOutflow[key] || 0,
        committedNet,
        forecastInflow: monthlyForecastInflow[key] || 0,
        forecastOutflow: monthlyForecastOutflow[key] || 0,
        forecastNet,
        executionPct: planNet !== 0 ? Math.round((actualNet / planNet) * 100) : 0,
      };
    }

    // Variance analysis: plan vs actual vs committed
    const linesWithVariance = budgetLines
      .map((l: any) => {
        const plannedTotal = sumMonthlyAmounts(l.plannedAmounts);
        const actualTotal = sumMonthlyAmounts(l.actualAmounts);
        const committedTotal = sumMonthlyAmounts(l.committedAmounts);
        const forecastTotal = sumMonthlyAmounts(l.forecastAmounts);
        const consumed = actualTotal + committedTotal;
        return {
          id: l.id,
          lineName: l.lineName,
          lineType: l.lineType,
          plannedTotal: Math.round(plannedTotal),
          actualTotal: Math.round(actualTotal),
          committedTotal: Math.round(committedTotal),
          consumedTotal: Math.round(consumed),
          forecastTotal: Math.round(forecastTotal),
          remaining: Math.round(plannedTotal - consumed),
          executionPct: plannedTotal !== 0 ? Math.round((consumed / plannedTotal) * 100) : 0,
          variance: Math.round(forecastTotal - plannedTotal),
        };
      })
      .sort((a: any, b: any) => Math.abs(b.executionPct - 100) - Math.abs(a.executionPct - 100))
      .slice(0, 15);

    return {
      year: targetYear,
      stats: {
        totalBudgets: budgets.length,
        activeBudgets: budgets.filter((b: any) => b.status === "active").length,
        openingCash: Math.round(openingCash),
        // Planned
        totalPlanInflow: Math.round(totalPlanInflow),
        totalPlanOutflow: Math.round(totalPlanOutflow),
        totalPlanNet: Math.round(totalPlanInflow - totalPlanOutflow),
        // Actual
        totalActualInflow: Math.round(totalActualInflow),
        totalActualOutflow: Math.round(totalActualOutflow),
        totalActualNet: Math.round(totalActualInflow - totalActualOutflow),
        // Committed
        totalCommittedInflow: Math.round(totalCommittedInflow),
        totalCommittedOutflow: Math.round(totalCommittedOutflow),
        totalCommittedNet: Math.round(totalCommittedInflow - totalCommittedOutflow),
        // Consumed (actual + committed)
        totalConsumedInflow: Math.round(totalActualInflow + totalCommittedInflow),
        totalConsumedOutflow: Math.round(totalActualOutflow + totalCommittedOutflow),
        totalConsumedNet: Math.round(totalActualInflow + totalCommittedInflow - totalActualOutflow - totalCommittedOutflow),
        // Forecast
        totalForecastInflow: Math.round(totalForecastInflow),
        totalForecastOutflow: Math.round(totalForecastOutflow),
        totalForecastNet: Math.round(totalForecastInflow - totalForecastOutflow),
        projectedClosing: Math.round(projectedClosing),
      },
      monthlyComparison,
      topVariances: linesWithVariance,
      budgets,
    };
  }
);

// ==========================================
// createPlanningBudget
// ==========================================

export const createPlanningBudget = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.create", { companyId });
    const { name, year, scenarioType, openingCash, notes } = request.data;
    if (!name || !year) throw new HttpsError("invalid-argument", "name y year requeridos");

    const cref = companyRef(companyId);

    // Solo un active por año
    const existingActive = await cref.collection("planningBudgets")
      .where("year", "==", year)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!existingActive.empty) {
      throw new HttpsError("already-exists", `Ya existe un presupuesto activo para el año ${year}`);
    }

    const ref = await cref.collection("planningBudgets").add({
      companyId,
      name,
      year,
      scenarioType: scenarioType || "base",
      status: "draft",
      openingCash: openingCash || 0,
      notes: notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: ref.id };
  }
);

// ==========================================
// updatePlanningBudget
// ==========================================

export const updatePlanningBudget = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.edit", { companyId });
    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);

    // Si se está activando, verificar que no haya otro activo para ese año
    if (data.status === "active") {
      const budgetSnap = await cref.collection("planningBudgets").doc(id).get();
      if (!budgetSnap.exists) throw new HttpsError("not-found", "Presupuesto no encontrado");
      const current = budgetSnap.data() as any;
      if (current.status !== "active") {
        const existingActive = await cref.collection("planningBudgets")
          .where("year", "==", current.year)
          .where("status", "==", "active")
          .limit(1)
          .get();
        if (!existingActive.empty && existingActive.docs[0].id !== id) {
          throw new HttpsError("already-exists", `Ya existe un presupuesto activo para el año ${current.year}`);
        }
      }
    }

    await cref.collection("planningBudgets").doc(id).update({
      ...data,
      updatedAt: nowIso(),
    });
    return { updated: true };
  }
);

// ==========================================
// createBudgetLine
// ==========================================

export const createBudgetLine = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.create", { companyId });
    const { budgetId, lineType, originType, lineName, category, costCenter, leadId, monthStart, monthEnd, plannedAmounts, forecastAmounts, actualAmounts, committedAmounts, notes } = request.data;
    if (!budgetId || !lineType || !lineName) {
      throw new HttpsError("invalid-argument", "budgetId, lineType y lineName requeridos");
    }

    const ref = await companyRef(companyId).collection("planningBudgetLines").add({
      budgetId,
      companyId,
      lineType,
      originType: originType || "manual",
      lineName,
      category: category || "General",
      costCenter: costCenter || "",
      leadId: leadId || "",
      monthStart: monthStart || 1,
      monthEnd: monthEnd || 12,
      plannedAmounts: plannedAmounts || {},
      forecastAmounts: forecastAmounts || {},
      actualAmounts: actualAmounts || {},
      committedAmounts: committedAmounts || {},
      notes: notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: ref.id };
  }
);

// ==========================================
// updateBudgetLine
// ==========================================

export const updateBudgetLine = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.edit", { companyId });
    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("planningBudgetLines").doc(id).update({
      ...data,
      updatedAt: nowIso(),
    });
    return { updated: true };
  }
);

// ==========================================
// deleteBudgetLine
// ==========================================

export const deleteBudgetLine = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.delete", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("planningBudgetLines").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// registerActualAmount
// ==========================================

export const registerActualAmount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.edit", { companyId });
    const { lineId, month, amount, sourceDocumentId, sourceDocumentType, notes } = request.data;
    if (!lineId || !month || typeof amount !== "number") {
      throw new HttpsError("invalid-argument", "lineId, month y amount requeridos");
    }

    const lineRef = companyRef(companyId).collection("planningBudgetLines").doc(lineId);
    const lineSnap = await lineRef.get();
    if (!lineSnap.exists) throw new HttpsError("not-found", "Línea no encontrada");

    const line = lineSnap.data()!;
    const currentActual = (line.actualAmounts as Record<string, number>) || {};
    const currentMonth = currentActual[String(month)] || 0;
    const newActual = { ...currentActual, [String(month)]: currentMonth + amount };

    await lineRef.update({
      actualAmounts: newActual,
      updatedAt: nowIso(),
    });

    // Log the actual registration
    await companyRef(companyId).collection("planningActualLogs").add({
      companyId,
      lineId,
      budgetId: line.budgetId,
      month: String(month),
      amount,
      sourceDocumentId: sourceDocumentId || null,
      sourceDocumentType: sourceDocumentType || null,
      notes: notes || "",
      registeredBy: request.auth.uid,
      createdAt: nowIso(),
    });

    return { updated: true, lineId, month, newTotal: newActual[String(month)] };
  }
);

// ==========================================
// registerCommittedAmount
// ==========================================

export const registerCommittedAmount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.edit", { companyId });
    const { lineId, month, amount, sourceDocumentId, sourceDocumentType, notes } = request.data;
    if (!lineId || !month || typeof amount !== "number") {
      throw new HttpsError("invalid-argument", "lineId, month y amount requeridos");
    }

    const lineRef = companyRef(companyId).collection("planningBudgetLines").doc(lineId);
    const lineSnap = await lineRef.get();
    if (!lineSnap.exists) throw new HttpsError("not-found", "Línea no encontrada");

    const line = lineSnap.data()!;
    const currentCommitted = (line.committedAmounts as Record<string, number>) || {};
    const currentMonth = currentCommitted[String(month)] || 0;
    const newCommitted = { ...currentCommitted, [String(month)]: currentMonth + amount };

    await lineRef.update({
      committedAmounts: newCommitted,
      updatedAt: nowIso(),
    });

    await companyRef(companyId).collection("planningCommittedLogs").add({
      companyId,
      lineId,
      budgetId: line.budgetId,
      month: String(month),
      amount,
      sourceDocumentId: sourceDocumentId || null,
      sourceDocumentType: sourceDocumentType || null,
      notes: notes || "",
      registeredBy: request.auth.uid,
      createdAt: nowIso(),
    });

    return { updated: true, lineId, month, newTotal: newCommitted[String(month)] };
  }
);
