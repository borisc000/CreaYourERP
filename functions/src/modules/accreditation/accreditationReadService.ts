import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// SERVICE ORDERS
// ==========================================

export const listServiceOrders = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const leadId = cleanString(data.leadId);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("serviceOrders").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (leadId) q = q.where("leadId", "==", leadId);

    const snap = await q.get();
    let orders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      orders = orders.filter((o: any) =>
        String(o.title || "").toLowerCase().includes(search) ||
        String(o.code || "").toLowerCase().includes(search)
      );
    }
    return { orders };
  }
);

export const getServiceOrder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const id = cleanString(request.data?.id || request.data?.serviceOrderId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("serviceOrders").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Orden de servicio no encontrada");

    const order = { id: snap.id, ...snap.data() };

    // Enrich with crew
    const crewSnap = await companyRef(companyId).collection("crewAssignments").where("serviceOrderId", "==", id).limit(200).get();
    const crew = crewSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return { order, crew };
  }
);

export const deleteServiceOrder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.delete_service_order", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const crewSnap = await ref.collection("crewAssignments").where("serviceOrderId", "==", id).limit(300).get();
    const genSnap = await ref.collection("documentGenerationRequests").where("serviceOrderId", "==", id).limit(300).get();

    const batch = db.batch();
    for (const doc of crewSnap.docs) batch.delete(doc.ref);
    for (const doc of genSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("serviceOrders").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { crew: crewSnap.size, generationRequests: genSnap.size } };
  }
);

// ==========================================
// CREW ASSIGNMENTS
// ==========================================

export const listCrewAssignments = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const data = request.data || {};
    const serviceOrderId = cleanString(data.serviceOrderId);
    const employeeId = cleanString(data.employeeId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("crewAssignments").orderBy("createdAt", "desc").limit(limit);
    if (serviceOrderId) q = q.where("serviceOrderId", "==", serviceOrderId);
    if (employeeId) q = q.where("employeeId", "==", employeeId);

    const snap = await q.get();
    return { assignments: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getCrewAssignment = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const id = cleanString(request.data?.id || request.data?.assignmentId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("crewAssignments").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Asignación no encontrada");
    return { assignment: { id: snap.id, ...snap.data() } };
  }
);

export const deleteCrewAssignment = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.delete_crew_assignment", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("crewAssignments").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// ACCREDITATION CHECK MATRIX
// ==========================================

export const getAccreditationCheckMatrix = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const serviceOrderId = cleanString(request.data?.serviceOrderId);
    if (!serviceOrderId) throw new HttpsError("invalid-argument", "serviceOrderId requerido");

    const ref = companyRef(companyId);

    // Get service order requirements
    const orderSnap = await ref.collection("serviceOrders").doc(serviceOrderId).get();
    const orderData = orderSnap.exists ? orderSnap.data() || {} : {};
    const requiredRequirementIds: string[] = orderData.requiredRequirementIds || [];
    const requiredCourseIds: string[] = orderData.requiredCourseIds || [];

    // Get crew assignments
    const crewSnap = await ref.collection("crewAssignments").where("serviceOrderId", "==", serviceOrderId).get();
    const assignments = crewSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Build matrix rows
    const rows: Array<{
      employeeId: string;
      employeeName: string;
      role: string;
      assignmentStatus: string;
      requirements: Array<{ requirementId: string; name: string; status: string; documentUrl?: string; expiresOn?: string }>;
      courses: Array<{ courseId: string; name: string; status: string; documentUrl?: string; expiresOn?: string }>;
      overallStatus: string;
    }> = [];

    for (const assignment of assignments) {
      const a: any = assignment;
      const employeeId = String(a.employeeId || "");
      if (!employeeId) continue;

      const empSnap = await ref.collection("employees").doc(employeeId).get();
      const empData = empSnap.exists ? empSnap.data() || {} : {};

      // Fetch employee accreditations
      const accSnap = await ref.collection("employees").doc(employeeId).collection("accreditations").get();
      const accreditations = accSnap.docs.map((d) => d.data());

      const requirementChecks = requiredRequirementIds.map((reqId: string) => {
        const acc = accreditations.find((ac: any) => ac.requirementId === reqId || ac.accreditationRequirementCode === reqId);
        return {
          requirementId: reqId,
          name: acc?.documentName || reqId,
          status: acc ? (acc.verificationStatus || "verified") : "missing",
          documentUrl: acc?.documentUrl || null,
          expiresOn: acc?.expiresOn || acc?.validUntil || null,
        };
      });

      const courseChecks = requiredCourseIds.map((courseId: string) => {
        const acc = accreditations.find((ac: any) => ac.courseId === courseId);
        return {
          courseId,
          name: acc?.documentName || courseId,
          status: acc ? (acc.verificationStatus || "verified") : "missing",
          documentUrl: acc?.documentUrl || null,
          expiresOn: acc?.expiresOn || acc?.validUntil || null,
        };
      });

      const allStatuses = [...requirementChecks, ...courseChecks].map((c) => c.status);
      const overallStatus = allStatuses.length === 0 ? "not_required" : allStatuses.every((s) => s === "verified" || s === "valid") ? "compliant" : allStatuses.some((s) => s === "missing") ? "incomplete" : "attention";

      rows.push({
        employeeId,
        employeeName: empData.fullName || `${empData.firstName || ""} ${empData.lastName || ""}`.trim() || "Sin nombre",
        role: a.role || "worker",
        assignmentStatus: a.status || "assigned",
        requirements: requirementChecks,
        courses: courseChecks,
        overallStatus,
      });
    }

    return { serviceOrderId, rows, totalEmployees: rows.length, compliantCount: rows.filter((r) => r.overallStatus === "compliant").length };
  }
);

// ==========================================
// DOCUMENT GENERATION REQUESTS
// ==========================================

export const listDocumentGenerationRequests = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.view_compliance", { companyId });

    const data = request.data || {};
    const serviceOrderId = cleanString(data.serviceOrderId);
    const employeeId = cleanString(data.employeeId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("documentGenerationRequests").orderBy("createdAt", "desc").limit(limit);
    if (serviceOrderId) q = q.where("serviceOrderId", "==", serviceOrderId);
    if (employeeId) q = q.where("employeeId", "==", employeeId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { requests: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

// ==========================================
// GENERATE ALL MISSING DOCUMENTS (BULK)
// ==========================================

export const generateAllMissingDocuments = onCall(
  { region: "us-central1", cors, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.generate_documents", { companyId });

    const serviceOrderId = cleanString(request.data?.serviceOrderId);
    if (!serviceOrderId) throw new HttpsError("invalid-argument", "serviceOrderId requerido");

    const ref = companyRef(companyId);
    const orderSnap = await ref.collection("serviceOrders").doc(serviceOrderId).get();
    if (!orderSnap.exists) throw new HttpsError("not-found", "Orden no encontrada");

    const orderData = orderSnap.data() || {};
    const requiredRequirementIds: string[] = orderData.requiredRequirementIds || [];
    const requiredCourseIds: string[] = orderData.requiredCourseIds || [];

    const crewSnap = await ref.collection("crewAssignments").where("serviceOrderId", "==", serviceOrderId).where("status", "in", ["assigned", "active"]).get();
    const assignments = crewSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const results: Array<{ employeeId: string; success: boolean; error?: string }> = [];
    const batch = db.batch();

    for (const assignment of assignments) {
      const a: any = assignment;
      const employeeId = String(a.employeeId || "");
      if (!employeeId) continue;

      // Find missing requirements for this employee
      const accSnap = await ref.collection("employees").doc(employeeId).collection("accreditations").get();
      const accreditations = accSnap.docs.map((d) => d.data());

      const missingReqs = requiredRequirementIds.filter((reqId: string) =>
        !accreditations.some((ac: any) => (ac.requirementId === reqId || ac.accreditationRequirementCode === reqId) && (ac.verificationStatus === "verified" || ac.status === "valid"))
      );
      const missingCourses = requiredCourseIds.filter((courseId: string) =>
        !accreditations.some((ac: any) => ac.courseId === courseId && (ac.verificationStatus === "verified" || ac.status === "valid"))
      );

      if (missingReqs.length === 0 && missingCourses.length === 0) {
        results.push({ employeeId, success: true });
        continue;
      }

      // Create generation request records for async processing
      try {
        for (const reqId of missingReqs) {
          const reqRef = ref.collection("documentGenerationRequests").doc();
          batch.set(reqRef, {
            companyId, serviceOrderId, employeeId,
            accreditationCheckId: reqId, checkType: "requirement",
            status: "pending", createdAt: nowIso(), updatedAt: nowIso(),
          });
        }
        for (const courseId of missingCourses) {
          const reqRef = ref.collection("documentGenerationRequests").doc();
          batch.set(reqRef, {
            companyId, serviceOrderId, employeeId,
            accreditationCheckId: courseId, checkType: "course",
            status: "pending", createdAt: nowIso(), updatedAt: nowIso(),
          });
        }
        results.push({ employeeId, success: true });
      } catch (err: any) {
        results.push({ employeeId, success: false, error: err.message || "Error de generación" });
      }
    }

    await batch.commit();
    const successCount = results.filter((r) => r.success).length;
    return { serviceOrderId, generated: successCount, failed: results.length - successCount, results };
  }
);
