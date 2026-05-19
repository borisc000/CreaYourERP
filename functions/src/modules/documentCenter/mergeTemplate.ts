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

interface MergePayload {
  templateId: string;
  employeeId: string;
  customerId?: string;
  serviceOrderId?: string;
  documentDate?: string;
  effectiveDate?: string;
  detailItems?: Array<{ label: string; value: string }>;
  notes?: string;
}

export const mergeDocumentTemplate = onCall(
  { region: "us-central1", cors, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "document_center.generate_document", { companyId });

    const payload = request.data as MergePayload;
    if (!payload.templateId || !payload.employeeId) {
      throw new HttpsError("invalid-argument", "templateId y employeeId son requeridos");
    }

    try {
      // Lazy-load docxtemplater to avoid top-level require issues with types
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Docxtemplater = require("docxtemplater");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PizZip = require("pizzip");

      // Fetch template
      const templateSnap = await companyRef(companyId)
        .collection("documentTemplates")
        .doc(payload.templateId)
        .get();
      if (!templateSnap.exists) {
        throw new HttpsError("not-found", "Plantilla no encontrada");
      }
      const template = templateSnap.data() || {};

      if (!template.storagePath || template.sourceFormat !== "docx") {
        throw new HttpsError("failed-precondition", "La plantilla no es un DOCX válido o no tiene archivo");
      }

      // Download template from Storage
      const bucket = storage.bucket();
      const [templateBuffer] = await bucket.file(template.storagePath).download();

      // Fetch data
      const empSnap = await companyRef(companyId).collection("employees").doc(payload.employeeId).get();
      if (!empSnap.exists) {
        throw new HttpsError("not-found", "Empleado no encontrado");
      }
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

      // Build merge data
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
          ? {
            name: customer.name || "N/A",
            rut: customer.rut || "",
            contactName: customer.contactName || "",
            contactEmail: customer.contactEmail || "",
          }
          : { name: "", rut: "", contactName: "", contactEmail: "" },
        serviceOrder: serviceOrder
          ? {
            title: serviceOrder.title || "N/A",
            code: serviceOrder.code || "",
            description: serviceOrder.description || "",
          }
          : { title: "", code: "", description: "" },
        documentDate: payload.documentDate || new Date().toLocaleDateString("es-CL"),
        effectiveDate: payload.effectiveDate || "",
        detailItems: payload.detailItems || [],
        notes: payload.notes || "",
      };

      // Merge DOCX
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.setData(mergeData);
      doc.render();
      const mergedBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" });

      // Save merged DOCX to Storage
      const fileName = `${template.filenamePattern || template.name}_${mergeData.employee.fullName.replace(/\s+/g, "_")}_${Date.now()}.docx`
        .replace(/[^a-zA-Z0-9_.-]/g, "");
      const storagePath = `companies/${companyId}/generated/${fileName}`;
      await bucket.file(storagePath).save(mergedBuffer, {
        metadata: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });

      // Create generated document record
      const now = new Date().toISOString();
      const genRef = companyRef(companyId).collection("generatedDocuments").doc();
      const genData = {
        companyId,
        templateId: payload.templateId,
        templateName: template.name,
        name: `${template.name} - ${mergeData.employee.fullName}`,
        outputFilename: fileName,
        outputFormat: "docx",
        recipientName: mergeData.employee.fullName,
        recipientEmail: employee.email || "",
        employeeId: payload.employeeId,
        customerId: payload.customerId || null,
        serviceOrderId: payload.serviceOrderId || null,
        targetModule: template.targetModule || "general",
        sourceModule: "document_center",
        sourceLabel: `${mergeData.employee.fullName} / ${template.name}`,
        mergePayload: mergeData,
        storagePath,
        availableFormats: ["docx"],
        status: "generated",
        requiresSignature: !!template.requiresSignature,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await genRef.set(genData);

      return { success: true, documentId: genRef.id, storagePath };
    } catch (error: any) {
      console.error("[mergeDocumentTemplate] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al mergear plantilla");
    }
  }
);
