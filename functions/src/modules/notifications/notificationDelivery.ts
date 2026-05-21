/**
 * Notification delivery engine.
 * - processNotificationQueue: scheduled function that processes pending notifications
 * - Channel router: email (SMTP), SMS (simulation), push (FCM simulation)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { sendEmailViaSmtp } from "../../shared/mailSender";

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

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// Scheduled queue processor
// Runs every 5 minutes
// ==========================================

export const processNotificationQueue = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
  },
  async () => {
    const companiesSnap = await db.collection("companies").limit(100).get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      try {
        const pendingSnap = await companyRef(companyId)
          .collection("notificationLogs")
          .where("status", "==", "pending")
          .where("scheduledAt", "<=", nowIso())
          .limit(50)
          .get();

        for (const doc of pendingSnap.docs) {
          const data = doc.data();
          try {
            await deliverNotification(companyId, doc.id, data);
          } catch (err: any) {
            console.error(`[processNotificationQueue] Failed to deliver ${doc.id}:`, err.message);
            await doc.ref.update({ status: "failed", error: err.message, failedAt: nowIso() });
          }
        }
      } catch (err: any) {
        console.error(`[processNotificationQueue] Company ${companyId} error:`, err.message);
      }
    }
  }
);

// ==========================================
// Channel delivery
// ==========================================

async function deliverNotification(
  companyId: string,
  logId: string,
  data: any
): Promise<void> {
  const channel = data.channel || "email";
  const recipient = data.recipient;
  const subject = data.subject || "Notificación";
  const body = data.body || "";

  const logRef = companyRef(companyId).collection("notificationLogs").doc(logId);

  if (channel === "email") {
    const result = await sendEmailViaSmtp(
      companyId,
      {
        to: [recipient],
        subject,
        text: body,
        html: data.htmlBody || undefined,
      }
    );

    if (result.success) {
      await logRef.update({ status: "sent", sentAt: nowIso(), messageId: result.messageId });
    } else {
      await logRef.update({ status: "failed", failedAt: nowIso(), error: result.error });
      throw new Error(result.error);
    }
  } else if (channel === "sms") {
    // SMS simulation: log only, no real provider yet
    console.log(`[SMS] To ${recipient}: ${subject}`);
    await logRef.update({ status: "sent", sentAt: nowIso(), channel: "sms_simulated" });
  } else if (channel === "push") {
    // Push notification simulation: log only, FCM not configured
    console.log(`[PUSH] To ${recipient}: ${subject}`);
    await logRef.update({ status: "sent", sentAt: nowIso(), channel: "push_simulated" });
  } else {
    await logRef.update({ status: "failed", failedAt: nowIso(), error: `Canal desconocido: ${channel}` });
    throw new Error(`Canal desconocido: ${channel}`);
  }
}

// ==========================================
// Callable: retry failed notification
// ==========================================

export const retryNotification = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    const logId = request.data?.logId;
    if (!logId) throw new HttpsError("invalid-argument", "logId requerido");

    const logRef = companyRef(companyId).collection("notificationLogs").doc(logId);
    const snap = await logRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Log no encontrado");

    const data = snap.data() || {};
    if (data.status !== "failed" && data.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solo se pueden reintentar notificaciones fallidas o pendientes");
    }

    await logRef.update({ status: "pending", retriedAt: nowIso(), error: null });
    await deliverNotification(companyId, logId, data);

    return { retried: true, logId };
  }
);

// ==========================================
// Callable: get notification delivery status
// ==========================================

export const getNotificationDeliveryStatus = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    const logId = request.data?.logId;
    if (!logId) throw new HttpsError("invalid-argument", "logId requerido");

    const snap = await companyRef(companyId).collection("notificationLogs").doc(logId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Log no encontrado");

    const data = snap.data() || {};
    return {
      status: data.status,
      sentAt: data.sentAt || null,
      failedAt: data.failedAt || null,
      error: data.error || null,
      messageId: data.messageId || null,
      channel: data.channel || "email",
    };
  }
);
