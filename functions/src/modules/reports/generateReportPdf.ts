import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertAction } from "../../shared/rbac";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

async function fetchImageBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.warn("[fetchImageBytes] Failed:", url, e);
    return null;
  }
}

export const generateReportPdf = onCall(
  { region: "us-central1", cors, memory: "1GiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "reports.edit_report", { companyId });

    const reportId = request.data?.reportId;
    if (!reportId) {
      throw new HttpsError("invalid-argument", "reportId requerido");
    }

    try {
      // Fetch report
      const reportSnap = await companyRef(companyId).collection("reports").doc(reportId).get();
      if (!reportSnap.exists) {
        throw new HttpsError("not-found", "Reporte no encontrado");
      }
      const report = reportSnap.data() || {};

      // Fetch checkpoints
      const cpSnap = await companyRef(companyId)
        .collection("reportCheckpoints")
        .where("reportId", "==", reportId)
        .orderBy("displayOrder")
        .get();
      const checkpoints = cpSnap.docs.map((d) => d.data());

      // Fetch photos
      const photoSnap = await companyRef(companyId)
        .collection("reportPhotos")
        .where("reportId", "==", reportId)
        .get();
      const photos = photoSnap.docs.map((d) => d.data());

      // Build PDF
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Helper to add page with header
      const addPageWithHeader = () => {
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        page.drawText("YourERP - Reporte de Terreno", { x: 40, y: height - 30, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
        page.drawLine({ start: { x: 40, y: height - 38 }, end: { x: width - 40, y: height - 38 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        return { page, width, height };
      };

      // === COVER PAGE ===
      const cover = pdfDoc.addPage();
      const { height: ch } = cover.getSize();
      cover.drawText("REPORTE DE TERRENO", { x: 40, y: ch - 80, size: 24, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      cover.drawText(report.servicio || "Sin servicio", { x: 40, y: ch - 120, size: 14, font, color: rgb(0.2, 0.2, 0.2) });

      const coverFields = [
        { label: "Empresa", value: report.empresa || "—" },
        { label: "Área", value: report.area || "—" },
        { label: "Sector", value: report.sector || "—" },
        { label: "APR", value: report.apr || "—" },
        { label: "Supervisor", value: report.supervisor || "—" },
        { label: "Mandante", value: report.mandante || "—" },
        { label: "Estado", value: report.status || "—" },
        { label: "Fecha creación", value: report.createdAt ? new Date(report.createdAt).toLocaleDateString("es-CL") : "—" },
      ];

      let cy = ch - 170;
      for (const f of coverFields) {
        cover.drawText(`${f.label}:`, { x: 40, y: cy, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
        cover.drawText(f.value, { x: 150, y: cy, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
        cy -= 20;
      }

      // === CHECKPOINTS ===
      if (checkpoints.length > 0) {
        // eslint-disable-next-line prefer-const
        let { page, width, height } = addPageWithHeader();
        let y = height - 60;
        page.drawText("CHECKPOINTS", { x: 40, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
        y -= 30;

        for (const cp of checkpoints) {
          if (y < 100) {
            const next = addPageWithHeader();
            page = next.page;
            width = next.width;
            y = next.height - 60;
          }

          const statusText = cp.completed ? "✓ Completado" : "○ Pendiente";
          const statusColor = cp.completed ? rgb(0.2, 0.6, 0.2) : rgb(0.6, 0.6, 0.2);

          page.drawText(`${cp.title || "Checkpoint"}`, { x: 40, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
          page.drawText(statusText, { x: width - 140, y, size: 10, font, color: statusColor });
          y -= 16;

          if (cp.description) {
            page.drawText(cp.description, { x: 50, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 14;
          }
          if (cp.observations) {
            page.drawText(`Obs: ${cp.observations}`, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
            y -= 14;
          }
          y -= 10;
        }
      }

      // === PHOTOS ===
      if (photos.length > 0) {
        // eslint-disable-next-line prefer-const
        let { page, height } = addPageWithHeader();
        let y = height - 60;
        page.drawText("FOTOS", { x: 40, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
        y -= 30;

        for (const p of photos) {
          const imgBytes = await fetchImageBytes(p.thumbnailUrl || p.photoUrl);
          if (!imgBytes) continue;

          let image;
          try {
            if (p.photoUrl?.endsWith(".png") || p.thumbnailUrl?.endsWith(".png")) {
              image = await pdfDoc.embedPng(imgBytes);
            } else {
              image = await pdfDoc.embedJpg(imgBytes);
            }
          } catch (imgErr) {
            console.warn("[generateReportPdf] Could not embed image:", imgErr);
            continue;
          }

          const imgWidth = 200;
          const imgHeight = (image.height / image.width) * imgWidth;

          if (y - imgHeight < 80) {
            const next = addPageWithHeader();
            page = next.page;
            y = next.height - 60;
          }

          page.drawImage(image, { x: 40, y: y - imgHeight, width: imgWidth, height: imgHeight });
          if (p.caption) {
            page.drawText(p.caption, { x: 40, y: y - imgHeight - 14, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
            y -= imgHeight + 28;
          } else {
            y -= imgHeight + 14;
          }
        }
      }

      // Footer on all pages
      const pages = pdfDoc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const { width } = p.getSize();
        p.drawText(`Página ${i + 1} de ${pages.length} - Documento generado desde YourERP`, {
          x: 40, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5),
        });
        p.drawText(`ID: ${reportId}`, { x: width - 120, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      }

      const pdfBuffer = Buffer.from(await pdfDoc.save());

      // Save to Storage
      const bucket = storage.bucket();
      const fileName = `report_${reportId}_${Date.now()}.pdf`;
      const storagePath = `companies/${companyId}/reports/${fileName}`;
      await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

      // Update report
      const now = new Date().toISOString();
      await companyRef(companyId).collection("reports").doc(reportId).update({
        generatedPdfPath: storagePath,
        updatedAt: now,
      });

      // Generate verification code if not exists
      if (!report.verificationCode) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await companyRef(companyId).collection("reports").doc(reportId).update({ verificationCode: code });
      }

      return { success: true, storagePath };
    } catch (error: any) {
      console.error("[generateReportPdf] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error generando PDF");
    }
  }
);
