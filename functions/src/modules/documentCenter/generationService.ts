/**
 * Cloud Functions para generación de documentos
 * - generateWorkerDocument: Genera PDF para un trabajador usando pdf-lib
 * - generateDocumentBatch: Genera batch simple desde JSON
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { buildWorkerPDF } from "../../shared/pdfGenerator";

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
