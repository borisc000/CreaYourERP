import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import { FieldValue } from "firebase-admin/firestore";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const linkProcedureToFolder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.link_procedure", { companyId });

    const { folderId, procedureId } = request.data;
    if (!folderId || !procedureId) throw new HttpsError("invalid-argument", "folderId y procedureId son requeridos");

    const folderRef = companyRef(companyId).collection("safetyFolders").doc(folderId);
    const procRef = companyRef(companyId).collection("safetyProcedureTemplates").doc(procedureId);

    const [folderSnap, procSnap] = await Promise.all([folderRef.get(), procRef.get()]);
    if (!folderSnap.exists) throw new HttpsError("not-found", "Carpeta no encontrada");
    if (!procSnap.exists) throw new HttpsError("not-found", "Procedimiento no encontrado");

    await db.runTransaction(async (t) => {
      t.update(folderRef, {
        procedureIds: FieldValue.arrayUnion(procedureId),
        updatedAt: nowIso(),
        _refreshMetricsPending: true,
      });
      t.update(procRef, {
        linkedFolderIds: FieldValue.arrayUnion(folderId),
        updatedAt: nowIso(),
      });
    });

    return { linked: true };
  }
);

export const unlinkProcedureFromFolder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.unlink_procedure", { companyId });

    const { folderId, procedureId } = request.data;
    if (!folderId || !procedureId) throw new HttpsError("invalid-argument", "folderId y procedureId son requeridos");

    const folderRef = companyRef(companyId).collection("safetyFolders").doc(folderId);
    const procRef = companyRef(companyId).collection("safetyProcedureTemplates").doc(procedureId);

    await db.runTransaction(async (t) => {
      t.update(folderRef, {
        procedureIds: FieldValue.arrayRemove(procedureId),
        updatedAt: nowIso(),
        _refreshMetricsPending: true,
      });
      t.update(procRef, {
        linkedFolderIds: FieldValue.arrayRemove(folderId),
        updatedAt: nowIso(),
      });
    });

    return { unlinked: true };
  }
);
