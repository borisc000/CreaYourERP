import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

export const getNotificationDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const [templates, logs] = await Promise.all([
      companyRef(companyId).collection("notificationTemplates").get(),
      companyRef(companyId).collection("notificationLogs").orderBy("createdAt", "desc").limit(50).get(),
    ]);
    return {
      totalTemplates: templates.size,
      recentLogs: logs.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

export const createNotificationTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, ...data } = request.data;
    if (!data.name || !data.bodyTemplate) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("notificationTemplates").add({
      companyId, name: data.name, channel: data.channel || "email",
      subjectTemplate: data.subjectTemplate || "", bodyTemplate: data.bodyTemplate,
      htmlBody: data.htmlBody || false, variables: data.variables || [],
      triggerEvent: data.triggerEvent || "", active: true,
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateNotificationTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("notificationTemplates").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const sendNotification = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { templateId, recipient, variables } = request.data;
    if (!recipient) throw new HttpsError("invalid-argument", "Datos incompletos");

    let template: any = null;
    if (templateId) {
      const t = await companyRef(companyId).collection("notificationTemplates").doc(templateId).get();
      if (t.exists) template = t.data();
    }

    const channel = template?.channel || "email";
    const subject = template?.subjectTemplate || "Notificación";
    let body = template?.bodyTemplate || variables?.body || "";

    // Simple variable replacement
    if (variables && typeof variables === "object") {
      for (const [key, value] of Object.entries(variables)) {
        body = body.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), String(value));
      }
    }

    const ref = await companyRef(companyId).collection("notificationLogs").add({
      companyId, templateId: templateId || null, recipient, channel, subject,
      bodyPreview: body.substring(0, 200), status: "sent",
      sentAt: nowIso(), createdAt: nowIso(),
    });

    // TODO: Integrate with real SMTP/SMS provider
    console.log(`[NOTIFICATION] ${channel} to ${recipient}: ${subject}`);

    return { id: ref.id, status: "sent" };
  }
);

export const saveNotificationPreference = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { companyId: _c, userId, eventType, ...prefs } = request.data;
    if (!userId || !eventType) throw new HttpsError("invalid-argument", "Datos incompletos");
    const existing = await companyRef(companyId).collection("notificationPreferences").where("userId", "==", userId).where("eventType", "==", eventType).limit(1).get();
    const data = {
      companyId, userId, eventType,
      emailEnabled: prefs.emailEnabled ?? true,
      smsEnabled: prefs.smsEnabled ?? false,
      pushEnabled: prefs.pushEnabled ?? true,
      inAppEnabled: prefs.inAppEnabled ?? true,
      updatedAt: nowIso(),
    };
    if (existing.empty) {
      const ref = await companyRef(companyId).collection("notificationPreferences").add(data);
      return { id: ref.id };
    } else {
      await existing.docs[0].ref.update(data);
      return { id: existing.docs[0].id, updated: true };
    }
  }
);
