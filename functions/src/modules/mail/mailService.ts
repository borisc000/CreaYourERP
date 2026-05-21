import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
];

function nowIso() {
  return new Date().toISOString();
}

function maskSecret(secret?: string) {
  const value = secret || "";
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(value.length - 4)}${value.slice(-2)}`;
}

export const getMailStatus = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.view", { companyId });

    const accounts = await db.collection("companies").doc(companyId).collection("mailAccounts").get();
    const active = accounts.docs.find((d) => d.data().isActive);
    const payload = active ? { ...active.data(), id: active.id, smtpPassword: maskSecret(active.data().smtpPassword) } : null;

    return {
      configured: !!active && !!active.data().smtpHost && !!active.data().smtpUser,
      activeAccount: payload,
      accountsCount: accounts.size,
    };
  }
);

export const saveMailAccount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.edit", { companyId });
    const { id, ...data } = request.data;

    if (data.isDefault) {
      const existing = await db.collection("companies").doc(companyId).collection("mailAccounts").where("isDefault", "==", true).get();
      for (const d of existing.docs) {
        if (d.id !== id) await d.ref.update({ isDefault: false });
      }
    }

    if (id) {
      const ref = db.collection("companies").doc(companyId).collection("mailAccounts").doc(id);
      await ref.update({ ...data, updatedAt: nowIso() });
      const snap = await ref.get();
      return { id, ...snap.data() };
    } else {
      const ref = await db.collection("companies").doc(companyId).collection("mailAccounts").add({
        ...data, companyId, isActive: true, createdAt: nowIso(), updatedAt: nowIso(),
      });
      return { id: ref.id, ...data, companyId };
    }
  }
);

export const sendEmail = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.create", { companyId });
    const { accountId, recipients, subject, bodyText, bodyHtml, attachmentStoragePaths } = request.data;
    if (!recipients?.length || !subject) throw new HttpsError("invalid-argument", "Datos incompletos");

    // Validate attachment paths belong to company
    const attachments: string[] = [];
    if (Array.isArray(attachmentStoragePaths)) {
      for (const path of attachmentStoragePaths) {
        if (typeof path === "string" && path.startsWith(`companies/${companyId}/`)) {
          attachments.push(path);
        }
      }
    }

    const logRef = await db.collection("companies").doc(companyId).collection("emailLogs").add({
      companyId, accountId: accountId || "", recipients, subject, bodyText: bodyText || "", bodyHtml: bodyHtml || "",
      attachmentStoragePaths: attachments,
      status: "queued", createdAt: nowIso(),
    });

    return { queued: true, logId: logRef.id, message: "Email encolado para envío", attachmentCount: attachments.length };
  }
);

export const getEmailLogs = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "mail.view", { companyId });
    const { limit = 50 } = request.data;

    const snap = await db.collection("companies").doc(companyId).collection("emailLogs").orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
);
