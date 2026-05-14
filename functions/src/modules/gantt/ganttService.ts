import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

const PHASE_DURATIONS: Record<string, number> = { general: 1, setup: 2, execution: 3, inspection: 1, closing: 1 };

export const getOrCreateGanttPlan = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { leadId } = request.data;
    if (!leadId) throw new HttpsError("invalid-argument", "Datos incompletos");

    const existing = await companyRef(companyId).collection("leadGanttPlans").where("leadId", "==", leadId).where("active", "==", true).limit(1).get();
    if (!existing.empty) {
      const plan = { id: existing.docs[0].id, ...existing.docs[0].data() };
      const tasks = await companyRef(companyId).collection("leadGanttTasks").where("planId", "==", plan.id).where("active", "==", true).orderBy("displayOrder").get();
      return { plan, tasks: tasks.docs.map((d) => ({ id: d.id, ...d.data() })) };
    }

    // Create new plan
    const ref = await companyRef(companyId).collection("leadGanttPlans").add({
      companyId, leadId, planName: "Plan preoperacional", status: "draft",
      plannedStartDate: nowIso().slice(0, 10), plannedEndDate: "",
      notes: "", progressPct: 0, active: true, createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { plan: { id: ref.id, companyId, leadId, planName: "Plan preoperacional", status: "draft", progressPct: 0 }, tasks: [] };
  }
);

export const importProcedureToGantt = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { planId, procedureId, mode = "replace" } = request.data;
    if (!planId || !procedureId) throw new HttpsError("invalid-argument", "Datos incompletos");

    if (mode === "replace") {
      const existing = await companyRef(companyId).collection("leadGanttTasks").where("planId", "==", planId).get();
      for (const d of existing.docs) await d.ref.update({ active: false });
    }

    const steps = await companyRef(companyId).collection("safetyProcedureSteps").where("procedureId", "==", procedureId).where("active", "==", true).orderBy("displayOrder").get();
    let currentDate = new Date();
    const tasks: any[] = [];

    for (const step of steps.docs) {
      const s = step.data();
      const duration = PHASE_DURATIONS[s.phaseName || "setup"] || 1;
      const start = currentDate.toISOString().slice(0, 10);
      currentDate.setDate(currentDate.getDate() + duration);
      const end = currentDate.toISOString().slice(0, 10);

      const ref = await companyRef(companyId).collection("leadGanttTasks").add({
        companyId, planId, leadId: (await companyRef(companyId).collection("leadGanttPlans").doc(planId).get()).data()?.leadId || "",
        procedureStepId: step.id, activityBlockId: s.activityBlockId || "",
        phaseName: s.phaseName || "setup", taskName: s.stepTitle || "Tarea", taskDescription: s.stepDescription || "",
        ownerName: s.ownerName || "", plannedStartDate: start, durationDays: duration, plannedEndDate: end,
        progressPct: 0, status: "pending", displayOrder: s.displayOrder || 0, active: true,
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      tasks.push({ id: ref.id });
    }

    await companyRef(companyId).collection("leadGanttPlans").doc(planId).update({ updatedAt: nowIso() });
    return { imported: true, tasksCount: tasks.length };
  }
);

export const createGanttTask = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, planId, ...data } = request.data;
    if (!planId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const plan = await companyRef(companyId).collection("leadGanttPlans").doc(planId).get();
    const ref = await companyRef(companyId).collection("leadGanttTasks").add({
      companyId, planId, leadId: plan.data()?.leadId || "",
      phaseName: data.phaseName || "setup", taskName: data.taskName || "Nueva tarea",
      taskDescription: data.taskDescription || "", ownerName: data.ownerName || "",
      plannedStartDate: data.plannedStartDate || nowIso().slice(0, 10),
      durationDays: data.durationDays || 1, plannedEndDate: data.plannedEndDate || "",
      progressPct: 0, status: "pending", displayOrder: data.displayOrder || 0, active: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateGanttTask = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const update: any = { ...data, updatedAt: nowIso() };
    if (data.progressPct !== undefined) {
      update.status = data.progressPct >= 100 ? "done" : data.progressPct > 0 ? "in_progress" : "pending";
    }
    await companyRef(companyId).collection("leadGanttTasks").doc(id).update(update);
    return { updated: true };
  }
);
