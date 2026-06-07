import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// PLANS
// ==========================================

export const listGanttPlans = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.view", { companyId });

    const data = request.data || {};
    const leadId = cleanString(data.leadId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("leadGanttPlans").orderBy("updatedAt", "desc").limit(limit);
    if (leadId) q = q.where("leadId", "==", leadId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { plans: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getGanttPlan = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.planId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("leadGanttPlans").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Plan no encontrado");

    const tasksSnap = await companyRef(companyId).collection("leadGanttTasks").where("planId", "==", id).where("active", "==", true).orderBy("displayOrder", "asc").get();
    return { plan: { id: snap.id, ...snap.data() }, tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deleteGanttPlan = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const tasksSnap = await ref.collection("leadGanttTasks").where("planId", "==", id).limit(500).get();
    const batch = db.batch();
    for (const doc of tasksSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("leadGanttPlans").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { tasks: tasksSnap.size } };
  }
);

// ==========================================
// TASKS
// ==========================================

export const listGanttTasks = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.view", { companyId });

    const data = request.data || {};
    const planId = cleanString(data.planId);
    const leadId = cleanString(data.leadId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("leadGanttTasks").orderBy("displayOrder", "asc").limit(limit);
    if (planId) q = q.where("planId", "==", planId);
    if (leadId) q = q.where("leadId", "==", leadId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { tasks: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getGanttTask = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.taskId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("leadGanttTasks").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Tarea no encontrada");
    return { task: { id: snap.id, ...snap.data() } };
  }
);

export const deleteGanttTask = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("leadGanttTasks").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getGanttReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "gantt.view_reference", { companyId });

    const [leadsSnap, proceduresSnap] = await Promise.all([
      companyRef(companyId).collection("leads").where("status", "==", "open").orderBy("title").limit(100).get(),
      companyRef(companyId).collection("safetyProcedures").where("active", "==", true).orderBy("name").limit(100).get(),
    ]);

    return {
      phases: [
        { code: "general", name: "General", defaultDuration: 1 },
        { code: "setup", name: "Preparación", defaultDuration: 2 },
        { code: "execution", name: "Ejecución", defaultDuration: 3 },
        { code: "inspection", name: "Inspección", defaultDuration: 1 },
        { code: "closing", name: "Cierre", defaultDuration: 1 },
      ],
      statuses: [
        { code: "pending", name: "Pendiente" },
        { code: "in_progress", name: "En progreso" },
        { code: "done", name: "Completada" },
        { code: "blocked", name: "Bloqueada" },
      ],
      planStatuses: [
        { code: "draft", name: "Borrador" },
        { code: "active", name: "Activo" },
        { code: "completed", name: "Completado" },
        { code: "cancelled", name: "Cancelado" },
      ],
      leads: leadsSnap.docs.map((d) => ({ id: d.id, title: d.data().title || "" })),
      procedures: proceduresSnap.docs.map((d) => ({ id: d.id, name: d.data().name || "" })),
    };
  }
);
