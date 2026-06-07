/**
 * Cloud Functions para Document Templates (CRUD)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface TemplatePayload {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  documentType?: string;
  targetModule?: string;
  scopeType?: string;
  subjectType?: string;
  status?: "draft" | "active" | "archived";
  customerId?: string;
  serviceOrderId?: string;
  serviceTypeId?: string;
  requiresSignature?: boolean;
  autoRegisterAccreditation?: boolean;
  accreditationRequirementCode?: string;
  accreditationCategory?: string;
  filenamePattern?: string;
  sourceFormat?: "docx" | "doc" | "pdf";
  placeholderKeys?: string[];
  tags?: string[];
  base64Content?: string;
  fileName?: string;
}

export const saveDocumentTemplate = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "document_center.save_template", { companyId });

    const payload = request.data as TemplatePayload;
    if (!payload.name?.trim()) {
      throw new HttpsError("invalid-argument", "El nombre es requerido");
    }

    try {
      const now = new Date().toISOString();
      let storagePath: string | undefined;

      if (payload.base64Content && payload.fileName) {
        const bucket = storage.bucket();
        const filePath = `companies/${companyId}/templates/${Date.now()}_${payload.fileName}`;
        const buffer = Buffer.from(payload.base64Content, "base64");
        await bucket.file(filePath).save(buffer, {
          metadata: {
            contentType:
              payload.sourceFormat === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        });
        storagePath = filePath;
      }

      const docPayload: Record<string, any> = {
        companyId,
        name: payload.name.trim(),
        description: payload.description || "",
        category: payload.category || "general",
        documentType: payload.documentType || "",
        targetModule: payload.targetModule || "general",
        scopeType: payload.scopeType || "general_empresa",
        subjectType: payload.subjectType || "trabajador",
        status: payload.status || "draft",
        customerId: payload.customerId || null,
        serviceOrderId: payload.serviceOrderId || null,
        serviceTypeId: payload.serviceTypeId || null,
        requiresSignature: !!payload.requiresSignature,
        autoRegisterAccreditation: !!payload.autoRegisterAccreditation,
        accreditationRequirementCode: payload.accreditationRequirementCode || "",
        accreditationCategory: payload.accreditationCategory || "",
        filenamePattern: payload.filenamePattern || "",
        sourceFormat: payload.sourceFormat || "docx",
        availableFormats: [payload.sourceFormat || "docx"],
        placeholderKeys: payload.placeholderKeys || [],
        placeholderValidationStatus: "pending",
        tags: payload.tags || [],
        updatedAt: now,
      };

      if (payload.id) {
        const ref = companyRef(companyId).collection("documentTemplates").doc(payload.id);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Plantilla no encontrada");
        }
        if (!storagePath) {
          const existing = snap.data() || {};
          docPayload.storagePath = existing.storagePath || "";
        } else {
          docPayload.storagePath = storagePath;
        }
        await ref.update(docPayload);
        return { success: true, id: payload.id };
      } else {
        const ref = companyRef(companyId).collection("documentTemplates").doc();
        await ref.set({ ...docPayload, storagePath: storagePath || "", createdAt: now });
        return { success: true, id: ref.id };
      }
    } catch (error: any) {
      console.error("[saveDocumentTemplate] Error:", error);
      throw new HttpsError("internal", error.message || "Error al guardar plantilla");
    }
  }
);

export const listDocumentTemplates = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "document_center.view", { companyId });

    const data = request.data || {};
    const status = (data.status || "").trim();
    const category = (data.category || "").trim();
    const search = (data.search || "").trim().toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("documentTemplates").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (category) q = q.where("category", "==", category);

    const snap = await q.get();
    let templates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      templates = templates.filter((t: any) =>
        String(t.name || "").toLowerCase().includes(search) ||
        String(t.description || "").toLowerCase().includes(search)
      );
    }
    return { templates };
  }
);

export const getDocumentTemplate = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "document_center.view", { companyId });

    const id = (request.data?.id || request.data?.templateId || "").trim();
    if (!id) throw new HttpsError("invalid-argument", "id es requerido");

    const snap = await companyRef(companyId).collection("documentTemplates").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Plantilla no encontrada");
    return { template: { id: snap.id, ...snap.data() } };
  }
);

export const deleteDocumentTemplate = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "document_center.delete_template", { companyId });

    const { id } = request.data as { id: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      const genSnap = await companyRef(companyId)
        .collection("generatedDocuments")
        .where("templateId", "==", id)
        .limit(1)
        .get();

      if (!genSnap.empty) {
        throw new HttpsError("failed-precondition", "No se puede eliminar: ya hay documentos generados con esta plantilla");
      }

      const ref = companyRef(companyId).collection("documentTemplates").doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.storagePath) {
          try {
            await storage.bucket().file(data.storagePath).delete();
          } catch (e) {
            console.warn("Could not delete storage file:", e);
          }
        }
      }

      await ref.delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteDocumentTemplate] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar plantilla");
    }
  }
);
