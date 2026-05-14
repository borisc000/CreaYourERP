import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function randomToken() { return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }

export const getReportDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const [reports, checkpoints] = await Promise.all([
      companyRef(companyId).collection("reports").get(),
      companyRef(companyId).collection("reportCheckpoints").get(),
    ]);
    const reportList = reports.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      totalReports: reports.size,
      openReports: reportList.filter((r: any) => r.status === "abierto").length,
      closedReports: reportList.filter((r: any) => r.status === "cerrado").length,
      totalCheckpoints: checkpoints.size,
      recentReports: reportList.slice(0, 10),
    };
  }
);

export const createReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, leadId, ...data } = request.data;
    if (!leadId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("reports").add({
      companyId, leadId, status: "abierto", publicToken: randomToken(),
      servicio: data.servicio || "", empresa: data.empresa || "", area: data.area || "", sector: data.sector || "",
      apr: data.apr || "", supervisor: data.supervisor || "", adm: data.adm || "", mandante: data.mandante || "",
      notes: data.notes || "", createdByUserId: request.auth?.uid || "",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    const checkpointTypes = ["inicial", "control", "entrega", "termino"];
    for (let i = 0; i < checkpointTypes.length; i++) {
      await companyRef(companyId).collection("reportCheckpoints").add({
        companyId, reportId: ref.id, checkpointType: checkpointTypes[i],
        title: `Checkpoint ${checkpointTypes[i]}`, description: "", observations: "",
        completed: false, displayOrder: i, createdAt: nowIso(), updatedAt: nowIso(),
      });
    }
    return { id: ref.id };
  }
);

export const updateReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("reports").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const closeReport = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("reports").doc(id).update({
      status: "cerrado", closedAt: nowIso(), closedByUserId: request.auth?.uid || "", updatedAt: nowIso(),
    });
    return { closed: true };
  }
);

export const createCheckpoint = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, reportId, ...data } = request.data;
    if (!reportId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("reportCheckpoints").add({
      companyId, reportId, checkpointType: data.checkpointType || "control",
      title: data.title || "Nuevo checkpoint", description: data.description || "",
      observations: data.observations || "", completed: false, displayOrder: data.displayOrder || 0,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateCheckpoint = onCall(
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
    if (data.completed === true) {
      update.completedAt = nowIso();
      update.completedByUserId = request.auth?.uid || "";
    }
    await companyRef(companyId).collection("reportCheckpoints").doc(id).update(update);
    return { updated: true };
  }
);

export const addReportPhoto = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, reportId, checkpointId, photoUrl, ...data } = request.data;
    if (!reportId || !checkpointId || !photoUrl) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("reportPhotos").add({
      companyId, reportId, checkpointId, photoUrl,
      thumbnailUrl: data.thumbnailUrl || photoUrl, caption: data.caption || "",
      takenAt: data.takenAt || nowIso(), takenByUserId: request.auth?.uid || "",
      createdAt: nowIso(),
    });
    return { id: ref.id };
  }
);
