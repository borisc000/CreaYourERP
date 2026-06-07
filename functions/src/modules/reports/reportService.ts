import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { uploadBase64ToStorage } from "../../shared/storageService";
import { assertAction } from "../../shared/rbac";

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
    await assertAction(request, "reports.view_dashboard", { companyId });
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
    await assertAction(request, "reports.create_report", { companyId });
    const { companyId: _, leadId, ...data } = request.data;
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
    await assertAction(request, "reports.edit_report", { companyId });
    const { companyId: _, id, ...data } = request.data;
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
    await assertAction(request, "reports.close_report", { companyId });
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
    await assertAction(request, "reports.create_checkpoint", { companyId });
    const { companyId: _, reportId, ...data } = request.data;
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
    await assertAction(request, "reports.edit_checkpoint", { companyId });
    const { companyId: _, id, ...data } = request.data;
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
    await assertAction(request, "reports.add_photo", { companyId });
    const { companyId: _, reportId, checkpointId, photoUrl, photoBase64, ...data } = request.data;
    if (!reportId || !checkpointId) throw new HttpsError("invalid-argument", "Datos incompletos");

    let finalPhotoUrl = photoUrl || "";
    let finalThumbnailUrl = data.thumbnailUrl || photoUrl || "";
    let storagePath = "";
    let thumbnailStoragePath = "";

    // If base64 provided, upload to Storage
    if (photoBase64 && typeof photoBase64 === "string") {
      const contentType = data.contentType || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : "jpg";
      const timestamp = Date.now();
      const uploadResult = await uploadBase64ToStorage(
        companyId,
        photoBase64,
        `reports/${reportId}/photos/${timestamp}.${ext}`,
        contentType
      );
      finalPhotoUrl = uploadResult.downloadUrl;
      storagePath = uploadResult.storagePath;

      // Thumbnail: if thumbnailBase64 provided, upload it too
      if (data.thumbnailBase64 && typeof data.thumbnailBase64 === "string") {
        const thumbResult = await uploadBase64ToStorage(
          companyId,
          data.thumbnailBase64,
          `reports/${reportId}/photos/${timestamp}_thumb.${ext}`,
          contentType
        );
        finalThumbnailUrl = thumbResult.downloadUrl;
        thumbnailStoragePath = thumbResult.storagePath;
      } else {
        finalThumbnailUrl = finalPhotoUrl;
        thumbnailStoragePath = storagePath;
      }
    }

    if (!finalPhotoUrl) throw new HttpsError("invalid-argument", "photoUrl o photoBase64 requerido");

    const ref = await companyRef(companyId).collection("reportPhotos").add({
      companyId, reportId, checkpointId, photoUrl: finalPhotoUrl,
      thumbnailUrl: finalThumbnailUrl || finalPhotoUrl, caption: data.caption || "",
      storagePath, thumbnailStoragePath,
      takenAt: data.takenAt || nowIso(), takenByUserId: request.auth?.uid || "",
      createdAt: nowIso(),
    });
    return { id: ref.id, photoUrl: finalPhotoUrl, storagePath };
  }
);
