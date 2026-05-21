import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import { testSmtpConnection } from "../../shared/mailSender";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function nowIso() { return new Date().toISOString(); }

// ==========================================
// MAIL ACCOUNTS
// ==========================================

export const listMailAccounts = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.view", { companyId });

    const data = request.data || {};
    const limit = Math.min(200, Math.max(1, Number(data.limit || 50)));

    const snap = await companyRef(companyId).collection("mailAccounts").orderBy("updatedAt", "desc").limit(limit).get();
    return { accounts: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getMailAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.accountId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("mailAccounts").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Cuenta no encontrada");
    return { account: { id: snap.id, ...snap.data() } };
  }
);

export const deleteMailAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("mailAccounts").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// EMAIL LOGS
// ==========================================

export const getEmailLog = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.logId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("emailLogs").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Log no encontrado");
    return { log: { id: snap.id, ...snap.data() } };
  }
);

export const deleteEmailLog = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.edit", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("emailLogs").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// TEST CONNECTION
// ==========================================

export const testMailConnection = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.edit", { companyId });

    const id = cleanString(request.data?.id || request.data?.accountId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("mailAccounts").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Cuenta no encontrada");

    const account = snap.data() || {};
    const required = ["smtpHost", "smtpPort", "smtpUser", "smtpPassword", "defaultFromEmail"];
    const missing = required.filter((k) => !account[k]);
    if (missing.length > 0) {
      throw new HttpsError("failed-precondition", `Faltan campos: ${missing.join(", ")}`);
    }

    const result = await testSmtpConnection({
      smtpHost: account.smtpHost,
      smtpPort: Number(account.smtpPort) || 587,
      smtpUser: account.smtpUser,
      smtpPassword: account.smtpPassword,
      defaultFromEmail: account.defaultFromEmail || account.smtpUser,
      defaultFromName: account.defaultFromName || "YourERP",
      useTls: account.useTls !== false,
    });

    await snap.ref.update({
      lastTestedAt: nowIso(),
      lastTestStatus: result.success ? "ok" : "error",
      lastTestError: result.success ? "" : result.message,
    });

    return { tested: true, status: result.success ? "ok" : "error", message: result.message };
  }
);
