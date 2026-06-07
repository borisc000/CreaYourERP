import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

export const publishReportMirror = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "reports.edit_report", { companyId });

    const reportId = request.data?.reportId;
    if (!reportId) throw new HttpsError("invalid-argument", "reportId requerido");

    const reportRef = db.collection("companies").doc(companyId).collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError("not-found", "Reporte no encontrado");
    const report = reportSnap.data() as any;
    if (report.companyId !== companyId) throw new HttpsError("permission-denied", "No tienes acceso a este reporte");

    const token = report.publicToken || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (!report.publicToken) {
      await reportRef.update({ publicToken: token });
    }

    // Get checkpoints
    const cpSnap = await db.collection("companies").doc(companyId).collection("reportCheckpoints").where("reportId", "==", reportId).orderBy("displayOrder").get();
    const checkpoints = cpSnap.docs.map((d) => {
      const c = d.data();
      return {
        title: c.title,
        description: c.description,
        observations: c.observations,
        completed: c.completed,
        completedAt: c.completedAt,
      };
    });

    // Get photos
    const photoSnap = await db.collection("companies").doc(companyId).collection("reportPhotos").where("reportId", "==", reportId).get();
    const photos = photoSnap.docs.map((d) => {
      const p = d.data();
      return {
        photoUrl: p.photoUrl,
        caption: p.caption,
        checkpointId: p.checkpointId,
      };
    });

    const mirrorData = {
      token,
      companyId,
      reportId,
      title: report.servicio || report.title || "Reporte de terreno",
      empresa: report.empresa || "",
      area: report.area || "",
      sector: report.sector || "",
      apr: report.apr || "",
      supervisor: report.supervisor || "",
      mandante: report.mandante || "",
      notes: report.notes || "",
      status: report.status || "",
      verificationCode: report.verificationCode || "",
      signatureStatus: report.signatureStatus || "",
      createdAt: report.createdAt,
      closedAt: report.closedAt,
      checkpoints,
      photos,
      publishedAt: new Date().toISOString(),
    };

    await db.collection("publicMirrors").doc(token).set(mirrorData);

    const origin = request.rawRequest?.headers?.origin || "https://your-erp.web.app";
    const mirrorUrl = `${origin}/mirror/report/${token}`;
    return { success: true, token, mirrorUrl };
  }
);
