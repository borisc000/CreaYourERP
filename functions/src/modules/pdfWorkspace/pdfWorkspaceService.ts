import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getPdfWorkspace = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "pdf_workspace.view", { companyId });
    const { documentId, documentType } = request.data;
    if (!documentId || !documentType) throw new HttpsError("invalid-argument", "Datos incompletos");

    const collection = documentType === "template" ? "documentTemplates" : "generatedDocuments";
    const doc = await companyRef(companyId).collection(collection).doc(documentId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Documento no encontrado");

    const data = doc.data()!;
    const isReadOnly = data.status === "signed" || data.status === "closed";

    const fieldsSnap = await companyRef(companyId).collection("pdfSignatureFields")
      .where("documentId", "==", documentId).where("documentType", "==", documentType).get();

    return {
      documentId, documentType,
      pdfUrl: data.pdfUrl || data.downloadUrl || null,
      signatureFields: fieldsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      version: data.pdfWorkspaceVersion || 1,
      isReadOnly,
      lastSavedAt: data.pdfWorkspaceSavedAt || null,
    };
  }
);

export const savePdfWorkspace = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "pdf_workspace.edit", { companyId });
    const { documentId, documentType, signatureFields } = request.data;
    if (!documentId || !documentType || !Array.isArray(signatureFields)) {
      throw new HttpsError("invalid-argument", "Datos incompletos");
    }

    const collection = documentType === "template" ? "documentTemplates" : "generatedDocuments";
    const doc = await companyRef(companyId).collection(collection).doc(documentId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Documento no encontrado");
    if (doc.data()?.status === "signed" || doc.data()?.status === "closed") {
      throw new HttpsError("failed-precondition", "No se puede editar un documento firmado o cerrado");
    }

    const batch = db.batch();

    // Delete existing fields
    const existing = await companyRef(companyId).collection("pdfSignatureFields")
      .where("documentId", "==", documentId).where("documentType", "==", documentType).get();
    for (const d of existing.docs) batch.delete(d.ref);

    // Add new fields
    for (const f of signatureFields) {
      const ref = companyRef(companyId).collection("pdfSignatureFields").doc();
      batch.set(ref, {
        companyId, documentId, documentType,
        pageIndex: f.pageIndex || 0, x: f.x || 0, y: f.y || 0,
        width: f.width || 100, height: f.height || 30,
        roleName: f.roleName || "", signerEmail: f.signerEmail || "",
        label: f.label || "", required: f.required !== false,
        createdAt: nowIso(),
      });
    }

    // Update document version
    const docRef = companyRef(companyId).collection(collection).doc(documentId);
    const newVersion = (doc.data()?.pdfWorkspaceVersion || 0) + 1;
    batch.update(docRef, { pdfWorkspaceVersion: newVersion, pdfWorkspaceSavedAt: nowIso(), updatedAt: nowIso() });

    await batch.commit();
    return { saved: true, version: newVersion };
  }
);
