import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getGoogleWorkspaceDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const accounts = await companyRef(companyId).collection("googleWorkspaceAccounts").get();
    const list = accounts.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      totalAccounts: accounts.size,
      activeAccounts: list.filter((a: any) => a.isActive).length,
      accounts: list.map((a: any) => ({ ...a, serviceAccountJson: undefined })),
    };
  }
);

export const createGoogleWorkspaceAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, ...data } = request.data;
    if (!data.name) throw new HttpsError("invalid-argument", "Datos incompletos");
    if (data.isDefault) {
      const existing = await companyRef(companyId).collection("googleWorkspaceAccounts").where("isDefault", "==", true).get();
      for (const d of existing.docs) await d.ref.update({ isDefault: false });
    }
    const ref = await companyRef(companyId).collection("googleWorkspaceAccounts").add({
      companyId, name: data.name, serviceAccountJson: data.serviceAccountJson || "",
      delegatedUser: data.delegatedUser || "", defaultDriveFolderId: data.defaultDriveFolderId || "",
      scopes: data.scopes || ["https://www.googleapis.com/auth/drive"], isDefault: data.isDefault || false,
      isActive: true, lastTestStatus: "pending", lastTestedAt: null,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateGoogleWorkspaceAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    if (data.isDefault) {
      const existing = await companyRef(companyId).collection("googleWorkspaceAccounts").where("isDefault", "==", true).get();
      for (const d of existing.docs) await d.ref.update({ isDefault: false });
    }
    await companyRef(companyId).collection("googleWorkspaceAccounts").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const testGoogleWorkspaceAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    // TODO: Implement real Google API connection test
    await companyRef(companyId).collection("googleWorkspaceAccounts").doc(id).update({
      lastTestStatus: "ok", lastTestMessage: "Conexión simulada exitosa", lastTestedAt: nowIso(), updatedAt: nowIso(),
    });
    return { status: "ok", message: "Conexión simulada exitosa" };
  }
);

export const listGoogleDriveFiles = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { accountId, query: _query } = request.data;
    if (!accountId) throw new HttpsError("invalid-argument", "Datos incompletos");
    // TODO: Implement real Google Drive API call
    return {
      files: [
        { id: "1", name: "Documento de ejemplo", mimeType: "application/vnd.google-apps.document", webViewLink: "#" },
        { id: "2", name: "Hoja de cálculo", mimeType: "application/vnd.google-apps.spreadsheet", webViewLink: "#" },
      ],
      simulated: true,
    };
  }
);
