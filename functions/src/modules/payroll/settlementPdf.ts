import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db, storage } from "../../config";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function formatCurrency(amount: number): string {
  return `$ ${Math.round(amount).toLocaleString("es-CL")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const generateSettlementPdf = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const { settlementId } = request.data;
    if (!settlementId) throw new HttpsError("invalid-argument", "settlementId requerido");

    const settleSnap = await companyRef(companyId).collection("payrollSettlements").doc(settlementId).get();
    if (!settleSnap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    const settle = settleSnap.data()!;

    const [empSnap, periodSnap, companySnap] = await Promise.all([
      companyRef(companyId).collection("employees").doc(settle.employeeId).get(),
      companyRef(companyId).collection("payrollPeriods").doc(settle.periodId).get(),
      companyRef(companyId).get(),
    ]);

    const emp = empSnap.exists ? empSnap.data()! : {};
    const period = periodSnap.exists ? periodSnap.data()! : {};
    const company = companySnap.exists ? companySnap.data()! : {};

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (text: string, x: number, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
      page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
    };

    const drawLine = (x1: number, x2: number, thickness = 0.5) => {
      page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: rgb(0.7, 0.7, 0.7) });
    };

    // Header
    drawText("LIQUIDACIÓN DE SUELDO", margin, 18, true);
    y -= 24;
    drawText(`${company.name || "EMPRESA"}  |  RUT: ${company.taxId || ""}`, margin, 10);
    y -= 28;
    drawLine(margin, pageWidth - margin);
    y -= 16;

    // Employee info
    drawText("DATOS DEL TRABAJADOR", margin, 11, true);
    y -= 16;
    drawText(`Nombre: ${emp.fullName || settle.employeeName || ""}`, margin, 10);
    y -= 14;
    drawText(`RUT: ${emp.cedula || ""}  |  Cargo: ${emp.positionTitle || ""}`, margin, 10);
    y -= 14;
    drawText(`Período: ${period.name || settle.periodId}  |  Días trabajados: ${settle.workedDays || 30}`, margin, 10);
    y -= 14;
    drawText(`Fecha de pago: ${formatDate(period.paymentDate || "")}`, margin, 10);
    y -= 20;
    drawLine(margin, pageWidth - margin);
    y -= 16;

    // Earnings table header
    drawText("HABERES", margin, 11, true);
    y -= 14;
    drawText("Concepto", margin + 10, 10, true);
    drawText("Monto", pageWidth - margin - 100, 10, true);
    y -= 8;
    drawLine(margin, pageWidth - margin);
    y -= 12;

    const lineItems = settle.lineItems || [];
    const earnings = lineItems.filter((li: any) => li.type === "earning" && li.amount > 0);
    const deductions = lineItems.filter((li: any) => li.type === "deduction" && li.amount > 0);

    for (const item of earnings) {
      drawText(item.concept, margin + 10, 10);
      drawText(formatCurrency(item.amount), pageWidth - margin - 100, 10);
      y -= 14;
    }
    y -= 4;
    drawLine(margin, pageWidth - margin);
    y -= 12;
    drawText("TOTAL HABERES", margin + 10, 10, true);
    drawText(formatCurrency(settle.totalEarnings || 0), pageWidth - margin - 100, 10, true);
    y -= 20;

    // Deductions table header
    drawText("DESCUENTOS", margin, 11, true);
    y -= 14;
    drawText("Concepto", margin + 10, 10, true);
    drawText("Monto", pageWidth - margin - 100, 10, true);
    y -= 8;
    drawLine(margin, pageWidth - margin);
    y -= 12;

    for (const item of deductions) {
      drawText(item.concept, margin + 10, 10);
      drawText(formatCurrency(item.amount), pageWidth - margin - 100, 10);
      y -= 14;
    }
    y -= 4;
    drawLine(margin, pageWidth - margin);
    y -= 12;
    drawText("TOTAL DESCUENTOS", margin + 10, 10, true);
    drawText(formatCurrency(settle.totalDeductions || 0), pageWidth - margin - 100, 10, true);
    y -= 24;
    drawLine(margin, pageWidth - margin, 1);
    y -= 14;

    // Net pay
    drawText("LÍQUIDO A PAGAR", margin + 10, 12, true);
    drawText(formatCurrency(settle.netPay || 0), pageWidth - margin - 100, 12, true, rgb(0, 0.5, 0));
    y -= 24;

    // Employer costs
    drawText("COSTOS PATRONALES", margin, 10, true, rgb(0.4, 0.4, 0.4));
    y -= 14;
    drawText(`AFC empleador: ${formatCurrency(settle.employerAfcAmount || 0)}`, margin + 10, 9, false, rgb(0.4, 0.4, 0.4));
    y -= 12;
    drawText(`SIS: ${formatCurrency(settle.employerSisAmount || 0)}`, margin + 10, 9, false, rgb(0.4, 0.4, 0.4));
    y -= 12;
    drawText(`Accidentes (Ley 16.744): ${formatCurrency(settle.employerAccidentAmount || 0)}`, margin + 10, 9, false, rgb(0.4, 0.4, 0.4));
    y -= 12;
    drawText(`Reforma previsional: ${formatCurrency(settle.employerPensionReformAmount || 0)}`, margin + 10, 9, false, rgb(0.4, 0.4, 0.4));
    y -= 12;
    drawText(`Total costos patronales: ${formatCurrency(settle.employerTotal || 0)}`, margin + 10, 9, true, rgb(0.4, 0.4, 0.4));
    y -= 28;

    // Warnings
    const warnings = settle.warnings || [];
    if (warnings.length > 0) {
      drawText("ADVERTENCIAS:", margin, 10, true, rgb(0.8, 0.3, 0));
      y -= 12;
      for (const w of warnings) {
        drawText(`• ${w}`, margin + 10, 9, false, rgb(0.8, 0.3, 0));
        y -= 12;
      }
      y -= 12;
    }

    // Signature lines
    drawLine(margin, pageWidth / 2 - 20);
    y -= 8;
    drawText("Firma empleador", margin + 10, 9, false, rgb(0.4, 0.4, 0.4));

    const rightX = pageWidth / 2 + 20;
    page.drawLine({ start: { x: rightX, y: y + 8 }, end: { x: rightX + 140, y: y + 8 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    page.drawText("Firma trabajador", { x: rightX + 10, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const bucket = storage.bucket();
    const fileName = `liquidacion_${settle.employeeName?.replace(/\s+/g, "_") || settle.employeeId}_${Date.now()}.pdf`;
    const storagePath = `companies/${companyId}/payroll/${settle.periodId}/${fileName}`;

    await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

    const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    await settleSnap.ref.update({
      pdfUrl: downloadUrl,
      pdfStoragePath: storagePath,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, downloadUrl, storagePath };
  }
);
