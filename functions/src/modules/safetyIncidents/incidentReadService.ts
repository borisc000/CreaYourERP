/**
 * Safety Incident read surface.
 * - list/get/delete incidents
 * - list/get/delete corrective actions
 * - dashboard KPIs
 * - stats by area and trends
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// INCIDENTS
// ==========================================

export const listSafetyIncidents = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const incidentType = cleanString(data.incidentType);
    const severity = cleanString(data.severity);
    const area = cleanString(data.area);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyIncidents").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (incidentType) q = q.where("incidentType", "==", incidentType);
    if (severity) q = q.where("severity", "==", severity);
    if (area) q = q.where("area", "==", area);

    const snap = await q.get();
    let incidents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      incidents = incidents.filter((i: any) =>
        String(i.title || "").toLowerCase().includes(search) ||
        String(i.code || "").toLowerCase().includes(search) ||
        String(i.description || "").toLowerCase().includes(search)
      );
    }
    return { incidents };
  }
);

export const getSafetyIncident = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.incidentId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyIncidents").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Incidente no encontrado");

    const [investigationSnap, actionsSnap] = await Promise.all([
      companyRef(companyId).collection("safetyInvestigations").where("incidentId", "==", id).limit(1).get(),
      companyRef(companyId).collection("safetyCorrectiveActions").where("incidentId", "==", id).get(),
    ]);

    return {
      incident: { id: snap.id, ...snap.data() },
      investigation: investigationSnap.empty ? null : { id: investigationSnap.docs[0].id, ...investigationSnap.docs[0].data() },
      correctiveActions: actionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

export const deleteSafetyIncident = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const batch = db.batch();

    // Delete investigation
    const investigationSnap = await companyRef(companyId).collection("safetyInvestigations").where("incidentId", "==", id).get();
    for (const doc of investigationSnap.docs) batch.delete(doc.ref);

    // Delete corrective actions
    const actionsSnap = await companyRef(companyId).collection("safetyCorrectiveActions").where("incidentId", "==", id).get();
    for (const doc of actionsSnap.docs) batch.delete(doc.ref);

    // Delete incident
    batch.delete(companyRef(companyId).collection("safetyIncidents").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { investigations: investigationSnap.size, correctiveActions: actionsSnap.size } };
  }
);

// ==========================================
// CORRECTIVE ACTIONS
// ==========================================

export const listCorrectiveActions = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const data = request.data || {};
    const incidentId = cleanString(data.incidentId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("safetyCorrectiveActions").orderBy("createdAt", "desc").limit(limit);
    if (incidentId) q = q.where("incidentId", "==", incidentId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { actions: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getCorrectiveAction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.actionId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Acción correctiva no encontrada");
    return { action: { id: snap.id, ...snap.data() } };
  }
);

export const deleteCorrectiveAction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.manage_capa", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// DASHBOARD & STATS
// ==========================================

export const getSafetyIncidentDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const cref = companyRef(companyId);
    const [incidentsSnap, actionsSnap] = await Promise.all([
      cref.collection("safetyIncidents").limit(1000).get(),
      cref.collection("safetyCorrectiveActions").limit(1000).get(),
    ]);

    const incidents = incidentsSnap.docs.map((d) => d.data());
    const actions = actionsSnap.docs.map((d) => d.data());

    const total = incidents.length;
    const open = incidents.filter((i: any) => i.status !== "closed").length;
    const closed = incidents.filter((i: any) => i.status === "closed").length;
    const underInvestigation = incidents.filter((i: any) => i.status === "under_investigation").length;
    const correctiveActionsPhase = incidents.filter((i: any) => i.status === "corrective_actions").length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byArea: Record<string, number> = {};

    for (const i of incidents) {
      byType[i.incidentType || "unknown"] = (byType[i.incidentType || "unknown"] || 0) + 1;
      bySeverity[i.severity || "unknown"] = (bySeverity[i.severity || "unknown"] || 0) + 1;
      byArea[i.area || "Sin área"] = (byArea[i.area || "Sin área"] || 0) + 1;
    }

    const openActions = actions.filter((a: any) => a.status === "open" || a.status === "in_progress").length;
    const completedActions = actions.filter((a: any) => a.status === "completed" || a.status === "verified").length;
    const overdueActions = actions.filter((a: any) => {
      if (a.status === "completed" || a.status === "verified" || a.status === "cancelled") return false;
      return a.dueDate && a.dueDate < new Date().toISOString().split("T")[0];
    }).length;

    return {
      total,
      open,
      closed,
      underInvestigation,
      correctiveActionsPhase,
      byType,
      bySeverity,
      byArea,
      correctiveActions: { total: actions.length, open: openActions, completed: completedActions, overdue: overdueActions },
    };
  }
);

export const getIncidentStatsByArea = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const snap = await companyRef(companyId).collection("safetyIncidents").limit(1000).get();
    const incidents = snap.docs.map((d) => d.data());

    const stats: Record<string, { total: number; open: number; closed: number; bySeverity: Record<string, number> }> = {};

    for (const i of incidents) {
      const area = i.area || "Sin área";
      if (!stats[area]) {
        stats[area] = { total: 0, open: 0, closed: 0, bySeverity: {} };
      }
      stats[area].total++;
      if (i.status === "closed") stats[area].closed++;
      else stats[area].open++;
      const sev = i.severity || "unknown";
      stats[area].bySeverity[sev] = (stats[area].bySeverity[sev] || 0) + 1;
    }

    return { stats };
  }
);

export const getIncidentTrends = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.view", { companyId });

    const data = request.data || {};
    const monthsBack = Math.min(24, Math.max(1, Number(data.monthsBack || 12)));

    const snap = await companyRef(companyId).collection("safetyIncidents").limit(2000).get();
    const incidents = snap.docs.map((d) => d.data());

    const trends: Record<string, { total: number; byType: Record<string, number> }> = {};

    const now = new Date();
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trends[key] = { total: 0, byType: {} };
    }

    for (const incident of incidents) {
      const created = incident.createdAt ? incident.createdAt.split("T")[0].substring(0, 7) : "";
      if (trends[created]) {
        trends[created].total++;
        const t = incident.incidentType || "unknown";
        trends[created].byType[t] = (trends[created].byType[t] || 0) + 1;
      }
    }

    return { trends };
  }
);
