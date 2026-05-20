import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// REPORTS
// ==========================================

export const listReports = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const leadId = cleanString(data.leadId);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("reports").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (leadId) q = q.where("leadId", "==", leadId);

    const snap = await q.get();
    let reports = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      reports = reports.filter((r: any) =>
        String(r.servicio || "").toLowerCase().includes(search) ||
        String(r.empresa || "").toLowerCase().includes(search) ||
        String(r.area || "").toLowerCase().includes(search)
      );
    }
    return { reports };
  }
);

export const getReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.reportId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("reports").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Reporte no encontrado");

    const [checkpointsSnap, photosSnap] = await Promise.all([
      companyRef(companyId).collection("reportCheckpoints").where("reportId", "==", id).orderBy("displayOrder", "asc").get(),
      companyRef(companyId).collection("reportPhotos").where("reportId", "==", id).orderBy("createdAt", "desc").get(),
    ]);

    return {
      report: { id: snap.id, ...snap.data() },
      checkpoints: checkpointsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      photos: photosSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

export const deleteReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.delete_report", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const [checkpointsSnap, photosSnap] = await Promise.all([
      ref.collection("reportCheckpoints").where("reportId", "==", id).limit(500).get(),
      ref.collection("reportPhotos").where("reportId", "==", id).limit(500).get(),
    ]);

    const batch = db.batch();
    for (const doc of checkpointsSnap.docs) batch.delete(doc.ref);
    for (const doc of photosSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("reports").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { checkpoints: checkpointsSnap.size, photos: photosSnap.size } };
  }
);

// ==========================================
// CHECKPOINTS
// ==========================================

export const listCheckpoints = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.view", { companyId });

    const data = request.data || {};
    const reportId = cleanString(data.reportId);
    const checkpointType = cleanString(data.checkpointType);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("reportCheckpoints").orderBy("displayOrder", "asc").limit(limit);
    if (reportId) q = q.where("reportId", "==", reportId);
    if (checkpointType) q = q.where("checkpointType", "==", checkpointType);

    const snap = await q.get();
    return { checkpoints: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getCheckpoint = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.checkpointId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("reportCheckpoints").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Checkpoint no encontrado");

    const photosSnap = await companyRef(companyId).collection("reportPhotos").where("checkpointId", "==", id).orderBy("createdAt", "desc").get();
    return { checkpoint: { id: snap.id, ...snap.data() }, photos: photosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deleteCheckpoint = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.delete_checkpoint", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const photosSnap = await ref.collection("reportPhotos").where("checkpointId", "==", id).limit(500).get();
    const batch = db.batch();
    for (const doc of photosSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("reportCheckpoints").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { photos: photosSnap.size } };
  }
);

// ==========================================
// PHOTOS
// ==========================================

export const listReportPhotos = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.view_photos", { companyId });

    const data = request.data || {};
    const reportId = cleanString(data.reportId);
    const checkpointId = cleanString(data.checkpointId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("reportPhotos").orderBy("createdAt", "desc").limit(limit);
    if (reportId) q = q.where("reportId", "==", reportId);
    if (checkpointId) q = q.where("checkpointId", "==", checkpointId);

    const snap = await q.get();
    return { photos: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);
