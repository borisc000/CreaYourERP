/**
 * Cloud Functions para generación de documentos
 * - generateWorkerDocument: Genera PDF para un trabajador usando pdf-lib
 * - generateDocumentBatch: Genera batch simple desde JSON
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface WorkerGeneratePayload {
  templateId: string;
  employeeId: string;
  customerId?: string;
  serviceOrderId?: string;
  leadId?: string;
  safetyFolderId?: string;
  targetModule?: string;
  targetRecordId?: string;
  documentDate?: string;
  effectiveDate?: string;
  detailItems?: Array<{ label: string; value: string }>;
  notes?: string;
}

async function buildWorkerPDF(
  company: any,
  template: any,
  employee: any,
  customer?: any,
  serviceOrder?: any,
  extraData?: any
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 40;

  // Header
  page.drawText(company.name || "Empresa", { x: 40, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  page.drawText(`Documento: ${template.name}`, { x: 40, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(`Generado: ${new Date().toLocaleDateString("es-CL")}`, { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  // Divider
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Worker section
  page.drawText("TRABAJADOR", { x: 40, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  y -= 16;
  const workerName = employee?.fullName || `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "N/A";
  page.drawText(`Nombre: ${workerName}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  page.drawText(`RUT: ${employee?.cedula || "N/A"}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  page.drawText(`Cargo: ${employee?.positionTitle || "N/A"}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  page.drawText(`Email: ${employee?.email || "N/A"}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;

  // Context section
  if (customer || serviceOrder || extraData) {
    page.drawText("CONTEXTO", { x: 40, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
    if (customer) {
      page.drawText(`Cliente: ${customer.name || "N/A"}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    if (serviceOrder) {
      page.drawText(`Orden de servicio: ${serviceOrder.title || "N/A"}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    if (extraData?.documentDate) {
      page.drawText(`Fecha documento: ${extraData.documentDate}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    if (extraData?.effectiveDate) {
      page.drawText(`Fecha efectiva: ${extraData.effectiveDate}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    y -= 10;
  }

  // Detail items
  if (extraData?.detailItems?.length) {
    page.drawText("DETALLE", { x: 40, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
    for (const item of extraData.detailItems) {
      page.drawText(`• ${item.label}: ${item.value}`, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
      if (y < 60) {
        // New page
        const newPage = pdfDoc.addPage();
        y = newPage.getSize().height - 40;
      }
    }
    y -= 10;
  }

  // Notes
  if (extraData?.notes) {
    page.drawText("NOTAS", { x: 40, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
    const lines = extraData.notes.split("\n");
    for (const line of lines) {
      page.drawText(line.slice(0, 100), { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
      if (y < 60) {
        const newPage = pdfDoc.addPage();
        y = newPage.getSize().height - 40;
      }
    }
  }

  // Footer
  for (const p of pdfDoc.getPages()) {
    p.drawText("Documento generado desde YourERP - No tiene validez legal sin firma", {
      x: 40,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return Buffer.from(await pdfDoc.save());
}

export const generateWorkerDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as WorkerGeneratePayload;
    if (!payload.templateId || !payload.employeeId) {
      throw new HttpsError("invalid-argument", "templateId y employeeId son requeridos");
    }

    try {
      // Fetch template
      const templateSnap = await companyRef(companyId).collection("documentTemplates").doc(payload.templateId).get();
      if (!templateSnap.exists) {
        throw new HttpsError("not-found", "Plantilla no encontrada");
      }
      const template = templateSnap.data() || {};

      // Fetch employee
      const empSnap = await companyRef(companyId).collection("employees").doc(payload.employeeId).get();
      if (!empSnap.exists) {
        throw new HttpsError("not-found", "Empleado no encontrado");
      }
      const employee = empSnap.data() || {};

      // Fetch company
      const companySnap = await db.collection("companies").doc(companyId).get();
      const company = companySnap.data() || {};

      // Fetch optional refs
      let customer: any = null;
      let serviceOrder: any = null;
      if (payload.customerId) {
        const c = await companyRef(companyId).collection("customers").doc(payload.customerId).get();
        if (c.exists) customer = c.data();
      }
      if (payload.serviceOrderId) {
        const s = await companyRef(companyId).collection("serviceOrders").doc(payload.serviceOrderId).get();
        if (s.exists) serviceOrder = s.data();
      }

      // Generate PDF
      const pdfBuffer = await buildWorkerPDF(company, template, employee, customer, serviceOrder, {
        documentDate: payload.documentDate,
        effectiveDate: payload.effectiveDate,
        detailItems: payload.detailItems,
        notes: payload.notes,
      });

      // Save to Storage
      const bucket = storage.bucket();
      const fileName = `${template.filenamePattern || template.name}_${employee.fullName || employee.firstName || "doc"}_${Date.now()}.pdf`
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_.-]/g, "");
      const storagePath = `companies/${companyId}/generated/${fileName}`;
      await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

      // Create generated document record
      const now = new Date().toISOString();
      const genRef = companyRef(companyId).collection("generatedDocuments").doc();
      const genData = {
        companyId,
        templateId: payload.templateId,
        templateName: template.name,
        name: `${template.name} - ${employee.fullName || employee.firstName || "Trabajador"}`,
        outputFilename: fileName,
        recipientName: employee.fullName || `${employee.firstName} ${employee.lastName}`,
        recipientEmail: employee.email || "",
        employeeId: payload.employeeId,
        customerId: payload.customerId || null,
        serviceOrderId: payload.serviceOrderId || null,
        targetModule: payload.targetModule || template.targetModule || "general",
        targetRecordId: payload.targetRecordId || null,
        sourceModule: payload.targetModule || "general",
        sourceRecordId: payload.targetRecordId || null,
        sourceLabel: `${employee.fullName || employee.firstName} / ${template.name}`,
        mergePayload: {
          employee: { fullName: employee.fullName, cedula: employee.cedula, positionTitle: employee.positionTitle, email: employee.email },
          customer: customer ? { name: customer.name } : null,
          serviceOrder: serviceOrder ? { title: serviceOrder.title } : null,
          documentDate: payload.documentDate,
          effectiveDate: payload.effectiveDate,
          detailItems: payload.detailItems,
          notes: payload.notes,
        },
        storagePath,
        availableFormats: ["pdf"],
        status: "generated",
        requiresSignature: !!template.requiresSignature,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await genRef.set(genData);

      return { success: true, documentId: genRef.id, storagePath };
    } catch (error: any) {
      console.error("[generateWorkerDocument] Error:", error);
      throw new HttpsError("internal", error.message || "Error al generar documento");
    }
  }
);
