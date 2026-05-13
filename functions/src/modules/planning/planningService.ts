import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
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

export const getPlanningDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { year } = request.data;

    const cref = companyRef(companyId);
    const targetYear = year || new Date().getFullYear();

    const [budgetsSnap, linesSnap] = await Promise.all([
      cref.collection("planningBudgets").where("year", "==", targetYear).get(),
      cref.collection("planningBudgetLines").get(),
    ]);

    const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
    const lines = linesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const activeBudget = budgets.find((b: any) => b.status === "active");
    const budgetIds = new Set(budgets.map((b: any) => b.id));
    const budgetLines = lines.filter((l: any) => budgetIds.has(l.budgetId));

    const monthlyInflow: Record<string, number> = {};
    const monthlyOutflow: Record<string, number> = {};
    const monthlyNet: Record<string, number> = {};

    for (let m = 1; m <= 12; m++) {
      const key = String(m);
      monthlyInflow[key] = 0;
      monthlyOutflow[key] = 0;
    }

    budgetLines.forEach((line: any) => {
      const isInflow = line.lineType === "inflow";
      Object.entries(line.plannedAmounts || {}).forEach(([month, amount]) => {
        const num = typeof amount === "number" ? amount : 0;
        if (isInflow) {
          monthlyInflow[month] = (monthlyInflow[month] || 0) + num;
        } else {
          monthlyOutflow[month] = (monthlyOutflow[month] || 0) + num;
        }
      });
    });

    for (let m = 1; m <= 12; m++) {
      const key = String(m);
      monthlyNet[key] = (monthlyInflow[key] || 0) - (monthlyOutflow[key] || 0);
    }

    const totalInflow = Object.values(monthlyInflow).reduce((a, b) => a + b, 0);
    const totalOutflow = Object.values(monthlyOutflow).reduce((a, b) => a + b, 0);
    const openingCash = activeBudget?.openingCash || 0;
    const projectedClosing = openingCash + totalInflow - totalOutflow;

    // Simple variance: compare planned vs forecast if available
    const linesWithVariance = budgetLines
      .filter((l: any) => l.forecastAmounts)
      .map((l: any) => {
        const plannedTotal = Object.values(l.plannedAmounts || {}).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
        const forecastTotal = Object.values(l.forecastAmounts || {}).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
        return {
          id: l.id,
          lineName: l.lineName,
          variance: forecastTotal - plannedTotal,
          variancePct: plannedTotal !== 0 ? Math.round(((forecastTotal - plannedTotal) / plannedTotal) * 100) : 0,
        };
      })
      .sort((a: any, b: any) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10);

    return {
      year: targetYear,
      stats: {
        totalBudgets: budgets.length,
        activeBudgets: budgets.filter((b: any) => b.status === "active").length,
        totalInflow: Math.round(totalInflow),
        totalOutflow: Math.round(totalOutflow),
        netCashflow: Math.round(totalInflow - totalOutflow),
        openingCash: Math.round(openingCash),
        projectedClosing: Math.round(projectedClosing),
      },
      monthlyProjection: {
        inflow: monthlyInflow,
        outflow: monthlyOutflow,
        net: monthlyNet,
      },
      budgets,
      topVariances: linesWithVariance,
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
    const { budgetId, lineType, originType, lineName, category, costCenter, leadId, monthStart, monthEnd, plannedAmounts, forecastAmounts, notes } = request.data;
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
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("planningBudgetLines").doc(id).delete();
    return { deleted: true };
  }
);
