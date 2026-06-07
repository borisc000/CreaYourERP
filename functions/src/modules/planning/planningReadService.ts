import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// BUDGETS
// ==========================================

export const listPlanningBudgets = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });

    const data = request.data || {};
    const year = Number(data.year) || 0;
    const status = cleanString(data.status);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("planningBudgets").orderBy("updatedAt", "desc").limit(limit);
    if (year) q = q.where("year", "==", year);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    let budgets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      budgets = budgets.filter((b: any) =>
        String(b.name || "").toLowerCase().includes(search)
      );
    }
    return { budgets };
  }
);

export const getPlanningBudget = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.budgetId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("planningBudgets").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Presupuesto no encontrado");

    const linesSnap = await companyRef(companyId).collection("planningBudgetLines").where("budgetId", "==", id).orderBy("createdAt", "desc").get();
    return { budget: { id: snap.id, ...snap.data() }, lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deletePlanningBudget = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const linesSnap = await ref.collection("planningBudgetLines").where("budgetId", "==", id).limit(500).get();
    const batch = db.batch();
    for (const doc of linesSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("planningBudgets").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { lines: linesSnap.size } };
  }
);

// ==========================================
// BUDGET LINES
// ==========================================

export const listBudgetLines = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });

    const data = request.data || {};
    const budgetId = cleanString(data.budgetId);
    const lineType = cleanString(data.lineType);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("planningBudgetLines").orderBy("createdAt", "desc").limit(limit);
    if (budgetId) q = q.where("budgetId", "==", budgetId);
    if (lineType) q = q.where("lineType", "==", lineType);

    const snap = await q.get();
    return { lines: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getBudgetLine = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.lineId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("planningBudgetLines").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Línea no encontrada");
    return { line: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getPlanningReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "planning.view", { companyId });

    return {
      scenarioTypes: [
        { code: "base", name: "Base" },
        { code: "forecast", name: "Pronóstico" },
        { code: "optimistic", name: "Optimista" },
        { code: "conservative", name: "Conservador" },
      ],
      statuses: [
        { code: "draft", name: "Borrador" },
        { code: "active", name: "Activo" },
        { code: "closed", name: "Cerrado" },
      ],
      lineTypes: [
        { code: "inflow", name: "Ingreso" },
        { code: "outflow", name: "Egreso" },
      ],
      originTypes: [
        { code: "project", name: "Proyecto" },
        { code: "operational", name: "Operacional" },
        { code: "administrative", name: "Administrativo" },
        { code: "financial", name: "Financiero" },
        { code: "other", name: "Otro" },
      ],
    };
  }
);
