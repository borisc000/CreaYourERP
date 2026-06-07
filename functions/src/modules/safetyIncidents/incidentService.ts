/**
 * Safety Incident service.
 * Provides CRUD for incidents/accidents/near-misses,
 * investigation workflow (5 whys, root cause),
 * and corrective actions (CAPA).
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

function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

// ==========================================
// INCIDENTS
// ==========================================

export const createIncident = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.create", { companyId });

    const {
      title, description, incidentType, severity, area, sector,
      reportedBy, involvedEmployees, occurredAt, location,
      immediateActions, equipmentInvolved, materialInvolved,
      environmentalImpact, propertyDamage, injuriesDescription,
      witnesses, photos, matrixId,
    } = request.data;

    if (!title || !incidentType) throw new HttpsError("invalid-argument", "title e incidentType son requeridos");

    const countSnap = await companyRef(companyId).collection("safetyIncidents").count().get();
    const code = `INC-${String(countSnap.data().count + 1).padStart(4, "0")}`;

    const ref = await companyRef(companyId).collection("safetyIncidents").add({
      companyId,
      code,
      title: title.trim(),
      description: description || "",
      incidentType: incidentType || "accident", // accident, incident, near_miss
      severity: severity || "low", // low, medium, high, critical
      status: "reported", // reported, under_investigation, corrective_actions, closed
      area: area || "",
      sector: sector || "",
      reportedBy: reportedBy || request.auth.uid,
      involvedEmployees: Array.isArray(involvedEmployees) ? involvedEmployees : [],
      occurredAt: occurredAt || nowIso(),
      location: location || "",
      immediateActions: immediateActions || "",
      equipmentInvolved: equipmentInvolved || "",
      materialInvolved: materialInvolved || "",
      environmentalImpact: environmentalImpact || false,
      propertyDamage: propertyDamage || false,
      injuriesDescription: injuriesDescription || "",
      witnesses: Array.isArray(witnesses) ? witnesses : [],
      photos: Array.isArray(photos) ? photos : [],
      matrixId: matrixId || "",
      investigationId: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: ref.id, code };
  }
);

export const updateIncident = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.edit", { companyId });

    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyIncidents").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Incidente no encontrado");

    await companyRef(companyId).collection("safetyIncidents").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

// ==========================================
// INVESTIGATION
// ==========================================

export const investigateIncident = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.investigate", { companyId });

    const {
      incidentId,
      investigationMethod,
      rootCauseCategories,
      rootCauseDescription,
      fiveWhys,
      contributingFactors,
      immediateCause,
      basicCause,
      witnessStatements,
      investigatorId,
      investigatorName,
    } = request.data;

    if (!incidentId) throw new HttpsError("invalid-argument", "incidentId requerido");

    const incidentSnap = await companyRef(companyId).collection("safetyIncidents").doc(incidentId).get();
    if (!incidentSnap.exists) throw new HttpsError("not-found", "Incidente no encontrado");

    // Create or update investigation
    const investigationData: Record<string, any> = {
      companyId,
      incidentId,
      investigationMethod: investigationMethod || "5_whys", // 5_whys, fishbone, fault_tree
      rootCauseCategories: Array.isArray(rootCauseCategories) ? rootCauseCategories : [],
      rootCauseDescription: rootCauseDescription || "",
      fiveWhys: Array.isArray(fiveWhys) ? fiveWhys : [],
      contributingFactors: Array.isArray(contributingFactors) ? contributingFactors : [],
      immediateCause: immediateCause || "",
      basicCause: basicCause || "",
      witnessStatements: Array.isArray(witnessStatements) ? witnessStatements : [],
      investigatorId: investigatorId || request.auth.uid,
      investigatorName: investigatorName || "",
      status: "completed",
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };

    let investigationRef;
    const existing = await companyRef(companyId).collection("safetyInvestigations").where("incidentId", "==", incidentId).limit(1).get();
    if (existing.empty) {
      investigationRef = await companyRef(companyId).collection("safetyInvestigations").add({
        ...investigationData,
        createdAt: nowIso(),
      });
    } else {
      investigationRef = existing.docs[0].ref;
      await investigationRef.update(investigationData);
    }

    // Update incident status
    await companyRef(companyId).collection("safetyIncidents").doc(incidentId).update({
      status: "corrective_actions",
      investigationId: investigationRef.id,
      updatedAt: nowIso(),
    });

    return { success: true, investigationId: investigationRef.id };
  }
);

// ==========================================
// CORRECTIVE ACTIONS (CAPA)
// ==========================================

export const createCorrectiveAction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.manage_capa", { companyId });

    const {
      incidentId, actionType, description, responsibleId, responsibleName,
      dueDate, priority, estimatedCost,
    } = request.data;

    if (!incidentId || !actionType || !description) {
      throw new HttpsError("invalid-argument", "incidentId, actionType y description son requeridos");
    }

    const incidentSnap = await companyRef(companyId).collection("safetyIncidents").doc(incidentId).get();
    if (!incidentSnap.exists) throw new HttpsError("not-found", "Incidente no encontrado");

    const ref = await companyRef(companyId).collection("safetyCorrectiveActions").add({
      companyId,
      incidentId,
      actionType: actionType || "corrective", // corrective, preventive, improvement
      description: description.trim(),
      responsibleId: responsibleId || "",
      responsibleName: responsibleName || "",
      dueDate: dueDate || "",
      priority: priority || "medium", // low, medium, high
      estimatedCost: estimatedCost || 0,
      status: "open", // open, in_progress, completed, verified, cancelled
      completionEvidence: "",
      completedAt: "",
      verifiedBy: "",
      verifiedAt: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: ref.id };
  }
);

export const updateCorrectiveAction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.manage_capa", { companyId });

    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Acción correctiva no encontrada");

    await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const closeCorrectiveAction = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety_incidents.manage_capa", { companyId });

    const { id, completionEvidence, verifiedBy } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Acción correctiva no encontrada");

    const now = nowIso();
    const updateData: Record<string, any> = {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    };
    if (completionEvidence) updateData.completionEvidence = completionEvidence;
    if (verifiedBy) {
      updateData.verifiedBy = verifiedBy;
      updateData.verifiedAt = now;
      updateData.status = "verified";
    }

    await companyRef(companyId).collection("safetyCorrectiveActions").doc(id).update(updateData);

    // Check if all actions for the incident are completed/verified
    const actionData = snap.data() || {};
    const incidentId = actionData.incidentId;
    if (incidentId) {
      const allActions = await companyRef(companyId)
        .collection("safetyCorrectiveActions")
        .where("incidentId", "==", incidentId)
        .get();
      const allCompleted = allActions.docs.every((d) => {
        const s = d.data().status;
        return s === "completed" || s === "verified" || s === "cancelled";
      });
      if (allCompleted) {
        await companyRef(companyId).collection("safetyIncidents").doc(incidentId).update({
          status: "closed",
          closedAt: now,
          updatedAt: now,
        });
      }
    }

    return { closed: true };
  }
);
