/**
 * Billing PDF generation service.
 * Generates invoice PDFs and stores them in Firebase Storage.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertAction } from "../../shared/rbac";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getSignedDownloadUrl } from "../../shared/storageService";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

function formatCurrency(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==========================================
// generateInvoicePdf
// ==========================================

export const generateInvoicePdf = onCall(
  { region: "us-central1", cors, memory: "1GiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "billing.create_document", { companyId });

    const documentId = request.data?.documentId;
    if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido");

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(documentId);
      const snap = await docRef.get();
      if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");
      const doc = snap.data() || {};

      // Fetch lines
      const linesSnap = await cref.collection("billingLines").where("documentId", "==", documentId).orderBy("createdAt").get();
      const lines = linesSnap.docs.map((d) => d.data());

      // Fetch company data
      const companySnap = await db.collection("companies").doc(companyId).get();
      const company = companySnap.data() || {};

      // Build PDF
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.addPage();
      const { height } = page.getSize();

      let y = height - 40;

      // Header
      page.drawText("YourERP - Documento de Facturación", { x: 40, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 30;

      page.drawText(`Empresa: ${company.name || company.businessName || ""}`, { x: 40, y, size: 10, font });
      y -= 18;
      page.drawText(`RUT: ${company.taxId || ""}`, { x: 40, y, size: 10, font });
      y -= 30;

      // Document info
      page.drawText(`Documento N°: ${doc.documentNumber || ""}`, { x: 40, y, size: 11, font: boldFont });
      y -= 18;
      page.drawText(`Tipo: ${doc.documentType || ""}`, { x: 40, y, size: 10, font });
      y -= 18;
      page.drawText(`Fecha emisión: ${doc.issueDate || ""}`, { x: 40, y, size: 10, font });
      y -= 18;
      page.drawText(`Fecha vencimiento: ${doc.dueDate || ""}`, { x: 40, y, size: 10, font });
      y -= 30;

      // Customer info
      page.drawText(`Cliente: ${doc.customerName || ""}`, { x: 40, y, size: 11, font: boldFont });
      y -= 18;
      page.drawText(`RUT Cliente: ${doc.customerTaxId || ""}`, { x: 40, y, size: 10, font });
      y -= 30;

      // Lines header
      page.drawText("Descripción", { x: 40, y, size: 10, font: boldFont });
      page.drawText("Cant.", { x: 320, y, size: 10, font: boldFont });
      page.drawText("P. Unit", { x: 370, y, size: 10, font: boldFont });
      page.drawText("Total", { x: 450, y, size: 10, font: boldFont });
      y -= 20;

      // Lines
      for (const line of lines) {
        const desc = String(line.description || "").substring(0, 45);
        page.drawText(desc, { x: 40, y, size: 9, font });
        page.drawText(String(line.quantity || 0), { x: 320, y, size: 9, font });
        page.drawText(formatCurrency(line.unitPrice || 0), { x: 370, y, size: 9, font });
        page.drawText(formatCurrency(line.lineTotal || 0), { x: 450, y, size: 9, font });
        y -= 16;
        if (y < 80) {
          // New page if running out of space
          const newPage = pdfDoc.addPage();
          y = newPage.getSize().height - 40;
        }
      }

      y -= 20;
      // Totals
      page.drawText(`Subtotal: ${formatCurrency(doc.subtotalAmount || 0)}`, { x: 350, y, size: 10, font });
      y -= 16;
      page.drawText(`Impuesto: ${formatCurrency(doc.taxAmount || 0)}`, { x: 350, y, size: 10, font });
      y -= 16;
      page.drawText(`Total: ${formatCurrency(doc.totalAmount || 0)}`, { x: 350, y, size: 12, font: boldFont });
      y -= 16;
      page.drawText(`Saldo pendiente: ${formatCurrency(doc.balanceDue || 0)}`, { x: 350, y, size: 10, font });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      // Save to Storage
      const bucket = storage.bucket();
      const fileName = `invoice_${documentId}_${Date.now()}.pdf`;
      const storagePath = `companies/${companyId}/billing/${fileName}`;
      await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

      // Update document
      await docRef.update({ pdfStoragePath: storagePath, pdfGeneratedAt: nowIso(), updatedAt: nowIso() });

      const downloadUrl = await getSignedDownloadUrl(storagePath, 60);

      return { success: true, storagePath, downloadUrl, documentId };
    } catch (error: any) {
      console.error("[generateInvoicePdf] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al generar PDF");
    }
  }
);

// ==========================================
// getInvoicePdfUrl
// ==========================================

export const getInvoicePdfUrl = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "billing.view", { companyId });

    const documentId = request.data?.documentId;
    if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido");

    const snap = await companyRef(companyId).collection("billingDocuments").doc(documentId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");
    const doc = snap.data() || {};

    if (!doc.pdfStoragePath) throw new HttpsError("failed-precondition", "El documento no tiene PDF generado");

    const downloadUrl = await getSignedDownloadUrl(doc.pdfStoragePath, 60);
    return { downloadUrl, storagePath: doc.pdfStoragePath, documentId };
  }
);
