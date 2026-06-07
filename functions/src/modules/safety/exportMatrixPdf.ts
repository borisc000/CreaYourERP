import { onCall, HttpsError } from "firebase-functions/v2/https";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export const exportSafetyMatrixPdf = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.export_miper", { companyId });

    const matrixId = request.data?.matrixId;
    if (!matrixId) throw new HttpsError("invalid-argument", "matrixId requerido");

    const cref = companyRef(companyId);
    const matrixSnap = await cref.collection("safetyRiskMatrices").doc(matrixId).get();
    if (!matrixSnap.exists) throw new HttpsError("not-found", "Matriz no encontrada");
    const matrix = matrixSnap.data() as any;

    const rowsSnap = await cref.collection("safetyRiskMatrixRows").where("riskMatrixId", "==", matrixId).orderBy("activityName").get();
    const rows = rowsSnap.docs.map((d) => d.data() as any);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595;
    const margin = 30;
    let page = pdfDoc.addPage([pageWidth, 842]);
    let y = 800;

    function drawText(text: string, x: number, size: number, bold = false, color = rgb(0, 0, 0)) {
      const f = bold ? fontBold : font;
      page.drawText(String(text || "").substring(0, 200), { x, y, size, font: f, color });
    }

    drawText(`Matriz de Riesgo: ${matrix.title || matrixId}`, margin, 16, true, rgb(0.1, 0.2, 0.4));
    y -= 28;
    drawText(`Código: ${matrix.code || "N/A"} | Proceso: ${matrix.processName || "N/A"} | Fecha: ${matrix.elaborationDate || new Date().toISOString().split("T")[0]}`, margin, 9);
    y -= 22;
    drawText(`Total riesgos: ${rows.length}`, margin, 9);
    y -= 28;

    const colX = [margin, 100, 200, 280, 340, 400, 460, 520];
    const headers = ["Actividad", "Peligro", "Riesgo", "P", "C", "VEP", "Nivel", "VR"];

    function drawRow(cells: string[], bold = false, fill = false) {
      if (y < 60) {
        page = pdfDoc.addPage([pageWidth, 842]);
        y = 800;
      }
      if (fill) {
        page.drawRectangle({ x: margin - 2, y: y - 2, width: pageWidth - margin * 2, height: 14, color: rgb(0.93, 0.93, 0.93) });
      }
      cells.forEach((cell, i) => {
        drawText(cell, colX[i], 8, bold);
      });
      y -= 16;
    }

    drawRow(headers, true);
    y -= 4;
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: pageWidth - margin, y: y + 10 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= 4;

    rows.forEach((r, idx) => {
      const vep = (r.probabilityValue || 0) * (r.consequenceValue || 0);
      drawRow(
        [
          (r.activityName || "").substring(0, 18),
          (r.hazardName || "").substring(0, 18),
          (r.riskName || "").substring(0, 18),
          String(r.probabilityValue || ""),
          String(r.consequenceValue || ""),
          String(vep || r.riskValue || ""),
          (r.riskLevelLabel || "").substring(0, 12),
          String(r.residualRiskValue || ""),
        ],
        false,
        idx % 2 === 0
      );
    });

    const pdfBytes = await pdfDoc.save();
    const base64 = Buffer.from(pdfBytes).toString("base64");
    return { success: true, base64, filename: `matriz_riesgo_${matrixId}.pdf` };
  }
);
