/**
 * Notification management callables
 * - markNotificationAsRead
 * - markAllNotificationsAsRead
 * - deleteNotification
 * - getUnreadNotificationCount
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export const markNotificationAsRead = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.manage", { companyId });

    const { notificationId } = request.data || {};
    if (!notificationId) throw new HttpsError("invalid-argument", "notificationId requerido");

    const ref = companyRef(companyId).collection("notifications").doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Notificación no encontrada");

    await ref.update({ read: true, readAt: new Date().toISOString() });
    return { success: true };
  }
);

export const markAllNotificationsAsRead = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    const userId = request.auth.uid;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.manage", { companyId });

    const q = companyRef(companyId)
      .collection("notifications")
      .where("userId", "==", userId)
      .where("read", "==", false)
      .limit(100);

    const snap = await q.get();
    const batch = db.batch();
    const now = new Date().toISOString();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true, readAt: now }));
    await batch.commit();

    return { success: true, updatedCount: snap.size };
  }
);

export const deleteNotification = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.manage", { companyId });

    const { notificationId } = request.data || {};
    if (!notificationId) throw new HttpsError("invalid-argument", "notificationId requerido");

    await companyRef(companyId).collection("notifications").doc(notificationId).delete();
    return { success: true };
  }
);

export const getUnreadNotificationCount = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string | undefined;
    const userId = request.auth.uid;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "notifications.view", { companyId });

    const q = companyRef(companyId)
      .collection("notifications")
      .where("userId", "==", userId)
      .where("read", "==", false)
      .count()
      .get();

    const count = (await q).data().count;
    return { count };
  }
);
