import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import { parseServiceAccount, getGoogleAccessToken, listDriveFiles } from "./googleAuth";

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
    await assertAction(request, "google_workspace.view", { companyId });
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
    await assertAction(request, "google_workspace.create", { companyId });
    const { companyId: _, ...data } = request.data;
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
    await assertAction(request, "google_workspace.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
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
    await assertAction(request, "google_workspace.edit", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const accountRef = companyRef(companyId).collection("googleWorkspaceAccounts").doc(id);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) throw new HttpsError("not-found", "Cuenta no encontrada");
    const account = accountSnap.data()!;

    const credentials = parseServiceAccount(account.serviceAccountJson || "");
    if (!credentials) {
      await accountRef.update({ lastTestStatus: "error", lastTestMessage: "serviceAccountJson inválido", lastTestedAt: nowIso(), updatedAt: nowIso() });
      throw new HttpsError("failed-precondition", "serviceAccountJson inválido");
    }

    try {
      const token = await getGoogleAccessToken(credentials, account.scopes || ["https://www.googleapis.com/auth/drive"]);
      await accountRef.update({
        lastTestStatus: "ok", lastTestMessage: "Conexión exitosa", lastTestedAt: nowIso(), updatedAt: nowIso(),
      });
      return { status: "ok", message: "Conexión exitosa", tokenType: token.token_type };
    } catch (err: any) {
      const msg = err.message || "Error de conexión";
      await accountRef.update({
        lastTestStatus: "error", lastTestMessage: msg, lastTestedAt: nowIso(), updatedAt: nowIso(),
      });
      throw new HttpsError("internal", msg);
    }
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
    await assertAction(request, "google_workspace.view", { companyId });
    const { accountId, query: _query } = request.data;
    if (!accountId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const accountRef = companyRef(companyId).collection("googleWorkspaceAccounts").doc(accountId);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) throw new HttpsError("not-found", "Cuenta no encontrada");
    const account = accountSnap.data()!;

    const credentials = parseServiceAccount(account.serviceAccountJson || "");
    if (!credentials) throw new HttpsError("failed-precondition", "serviceAccountJson inválido");

    try {
      const token = await getGoogleAccessToken(credentials, account.scopes || ["https://www.googleapis.com/auth/drive"]);
      const files = await listDriveFiles(token.access_token, {
        query: _query,
        pageSize: 20,
        folderId: account.defaultDriveFolderId || undefined,
      });
      return { files };
    } catch (err: any) {
      throw new HttpsError("internal", err.message || "Error listando archivos de Drive");
    }
  }
);
