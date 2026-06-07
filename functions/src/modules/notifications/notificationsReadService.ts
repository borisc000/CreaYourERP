import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// NOTIFICATION TEMPLATES
// ==========================================

export const listNotificationTemplates = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const data = request.data || {};
    const channel = cleanString(data.channel);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("notificationTemplates").orderBy("updatedAt", "desc").limit(limit);
    if (channel) q = q.where("channel", "==", channel);

    const snap = await q.get();
    return { templates: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getNotificationTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.templateId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("notificationTemplates").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Plantilla no encontrada");
    return { template: { id: snap.id, ...snap.data() } };
  }
);

export const deleteNotificationTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.manage", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("notificationTemplates").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// NOTIFICATION LOGS
// ==========================================

export const listNotificationLogs = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("notificationLogs").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { logs: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getNotificationLog = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.logId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("notificationLogs").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Log no encontrado");
    return { log: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// NOTIFICATIONS (USER)
// ==========================================

export const listNotifications = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const data = request.data || {};
    const userId = cleanString(data.userId) || request.auth.uid;
    const read = data.read;
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("notifications").orderBy("createdAt", "desc").limit(limit);
    if (userId) q = q.where("userId", "==", userId);
    if (typeof read === "boolean") q = q.where("read", "==", read);

    const snap = await q.get();
    return { notifications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getNotification = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.notificationId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("notifications").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Notificación no encontrada");
    return { notification: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// NOTIFICATION PREFERENCES
// ==========================================

export const listNotificationPreferences = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const data = request.data || {};
    const userId = cleanString(data.userId) || request.auth.uid;
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("notificationPreferences").orderBy("updatedAt", "desc").limit(limit);
    if (userId) q = q.where("userId", "==", userId);

    const snap = await q.get();
    return { preferences: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getNotificationPreference = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.preferenceId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("notificationPreferences").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Preferencia no encontrada");
    return { preference: { id: snap.id, ...snap.data() } };
  }
);

export const deleteNotificationPreference = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.manage", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("notificationPreferences").doc(id).delete();
    return { deleted: true };
  }
);
