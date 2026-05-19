import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

interface BatchPayload {
  templateId: string;
  employeeIds: string[];
}

async function generateForEmployee(
  companyId: string,
  template: any,
  employeeId: string,
  payload: any
): Promise<{ documentId: string; storagePath: string; success: boolean; error?: string }> {
  try {
    const empSnap = await companyRef(companyId).collection("employees").doc(employeeId).get();
    if (!empSnap.exists) return { documentId: "", storagePath: "", success: false, error: "Empleado no encontrado" };
    const employee = empSnap.data() || {};

    const companySnap = await db.collection("companies").doc(companyId).get();
    const company = companySnap.data() || {};

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

    const bucket = storage.bucket();
    const now = new Date().toISOString();

    let storagePath: string;
    let availableFormats: string[];

    if (template.sourceFormat === "docx" && template.storagePath) {
      // DOCX merge
      const Docxtemplater = require("docxtemplater");
      const PizZip = require("pizzip");

      const [templateBuffer] = await bucket.file(template.storagePath).download();
      const mergeData: Record<string, any> = {
        employee: {
          fullName: employee.fullName || `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "N/A",
          firstName: employee.firstName || "",
          lastName: employee.lastName || "",
          cedula: employee.cedula || employee.rut || "N/A",
          positionTitle: employee.positionTitle || "N/A",
          email: employee.email || "N/A",
          phone: employee.phone || "N/A",
          address: employee.address || "N/A",
        },
        company: {
          name: company.name || "Empresa",
          rut: company.rut || "",
          address: company.address || "",
          phone: company.phone || "",
          email: company.email || "",
        },
        customer: customer
          ? { name: customer.name || "N/A", rut: customer.rut || "", contactName: customer.contactName || "", contactEmail: customer.contactEmail || "" }
          : { name: "", rut: "", contactName: "", contactEmail: "" },
        serviceOrder: serviceOrder
          ? { title: serviceOrder.title || "N/A", code: serviceOrder.code || "", description: serviceOrder.description || "" }
          : { title: "", code: "", description: "" },
        documentDate: payload.documentDate || new Date().toLocaleDateString("es-CL"),
        effectiveDate: payload.effectiveDate || "",
        detailItems: payload.detailItems || [],
        notes: payload.notes || "",
      };

      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.setData(mergeData);
      doc.render();
      const mergedBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" });

      const fileName = `${template.filenamePattern || template.name}_${mergeData.employee.fullName.replace(/\s+/g, "_")}_${Date.now()}.docx`
        .replace(/[^a-zA-Z0-9_.-]/g, "");
      storagePath = `companies/${companyId}/generated/${fileName}`;
      await bucket.file(storagePath).save(mergedBuffer, {
        metadata: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });
      availableFormats = ["docx"];
    } else {
      // PDF generation (fallback)
      const { buildWorkerPDF } = await import("../../shared/pdfGenerator");
      const pdfBuffer = await buildWorkerPDF(company, template, employee, customer, serviceOrder, {
        documentDate: payload.documentDate,
        effectiveDate: payload.effectiveDate,
        detailItems: payload.detailItems,
        notes: payload.notes,
      });
      const fileName = `${template.filenamePattern || template.name}_${employee.fullName || employee.firstName || "doc"}_${Date.now()}.pdf`
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_.-]/g, "");
      storagePath = `companies/${companyId}/generated/${fileName}`;
      await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });
      availableFormats = ["pdf"];
    }

    const genRef = companyRef(companyId).collection("generatedDocuments").doc();
    await genRef.set({
      companyId,
      templateId: payload.templateId,
      templateName: template.name,
      name: `${template.name} - ${employee.fullName || employee.firstName || "Trabajador"}`,
      outputFilename: storagePath.split("/").pop(),
      outputFormat: availableFormats[0],
      recipientName: employee.fullName || `${employee.firstName} ${employee.lastName}`,
      recipientEmail: employee.email || "",
      employeeId,
      customerId: payload.customerId || null,
      serviceOrderId: payload.serviceOrderId || null,
      targetModule: template.targetModule || "general",
      sourceModule: "document_center",
      sourceLabel: `${employee.fullName || employee.firstName} / ${template.name}`,
      storagePath,
      availableFormats,
      status: "generated",
      requiresSignature: !!template.requiresSignature,
      tags: [],
      createdAt: now,
      updatedAt: now,
    });

    return { documentId: genRef.id, storagePath, success: true };
  } catch (err: any) {
    console.error(`[generateForEmployee] Error for ${employeeId}:`, err);
    return { documentId: "", storagePath: "", success: false, error: err.message || "Error de generación" };
  }
}

export const generateDocumentBatch = onCall(
  { region: "us-central1", cors, memory: "1GiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "document_center.generate_document", { companyId });

    const { templateId, employeeIds } = request.data as BatchPayload;
    if (!templateId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new HttpsError("invalid-argument", "templateId y employeeIds[] son requeridos");
    }
    if (employeeIds.length > 100) {
      throw new HttpsError("invalid-argument", "Máximo 100 empleados por lote");
    }

    const templateSnap = await companyRef(companyId).collection("documentTemplates").doc(templateId).get();
    if (!templateSnap.exists) {
      throw new HttpsError("not-found", "Plantilla no encontrada");
    }
    const template = templateSnap.data() || {};

    const now = new Date().toISOString();
    const batchRef = companyRef(companyId).collection("documentBatches").doc();

    const results: Array<{ employeeId: string; documentId: string; storagePath: string; success: boolean; error?: string }> = [];

    for (const employeeId of employeeIds) {
      const res = await generateForEmployee(companyId, template, employeeId, { templateId, ...request.data });
      results.push({ employeeId, ...res });
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    await batchRef.set({
      companyId,
      templateId,
      templateName: template.name,
      employeeIds,
      results: results.map((r) => ({
        employeeId: r.employeeId,
        documentId: r.documentId,
        success: r.success,
        error: r.error || null,
      })),
      successCount,
      failedCount,
      status: failedCount === 0 ? "completed" : failedCount === results.length ? "failed" : "partial",
      createdAt: now,
      updatedAt: now,
      createdBy: request.auth.uid,
    });

    return {
      batchId: batchRef.id,
      generatedCount: successCount,
      failedCount,
      documents: results.filter((r) => r.success),
    };
  }
);
