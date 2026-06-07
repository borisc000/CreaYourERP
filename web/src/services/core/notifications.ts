/**
 * Servicio de notificaciones centralizado.
 * Crea notificaciones en Firestore que el frontend puede escuchar en tiempo real.
 */

import { db, functions } from "@/firebase/config";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, or } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export type NotificationType =
  | "quote.accepted"
  | "quote.rejected"
  | "serviceOrder.assigned"
  | "accreditation.expiring"
  | "signature.requested"
  | "signature.signed"
  | "expense.approved"
  | "expense.rejected"
  | "billing.sii_accepted"
  | "safety.matrix_generated"
  | "system";

export interface Notification {
  id?: string;
  companyId: string;
  userId?: string;        // Destinatario (vacío = notificación de sistema)
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, any>;
  createdAt?: any;
  readAt?: string;
}

export async function createNotification(
  notification: Omit<Notification, "id" | "createdAt" | "read">
): Promise<void> {
  try {
    await addDoc(
      collection(db, "companies", notification.companyId, "notifications"),
      {
        ...notification,
        read: false,
        createdAt: serverTimestamp(),
      }
    );
  } catch (error) {
    console.error("[Notifications] Error creando notificación:", error);
  }
}

/**
 * Escucha notificaciones del usuario + notificaciones de sistema (userId vacío).
 */
export function subscribeToNotifications(
  companyId: string,
  userId: string,
  callback: (notifications: Notification[]) => void
) {
  const q = query(
    collection(db, "companies", companyId, "notifications"),
    or(where("userId", "==", userId), where("userId", "==", "")),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
    callback(notifications);
  });
}

// Callable wrappers
export async function markNotificationAsRead(notificationId: string) {
  return httpsCallable(functions, "markNotificationAsRead")({ notificationId });
}

export async function markAllNotificationsAsRead() {
  return httpsCallable(functions, "markAllNotificationsAsRead")();
}

export async function deleteNotification(notificationId: string) {
  return httpsCallable(functions, "deleteNotification")({ notificationId });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await httpsCallable(functions, "getUnreadNotificationCount")();
  return (res.data as any).count || 0;
}

export const NotificationTemplates = {
  quoteAccepted: (quoteTitle: string, amount: number) => ({
    type: "quote.accepted" as NotificationType,
    title: "Cotización aceptada",
    body: `"${quoteTitle}" fue aceptada por $${amount.toLocaleString("es-CL")}.`,
  }),

  accreditationExpiring: (employeeName: string, daysLeft: number) => ({
    type: "accreditation.expiring" as NotificationType,
    title: "Acreditación por vencer",
    body: `La acreditación de ${employeeName} vence en ${daysLeft} días.`,
  }),

  signatureRequested: (documentName: string) => ({
    type: "signature.requested" as NotificationType,
    title: "Firma solicitada",
    body: `Te han solicitado firmar "${documentName}".`,
  }),

  crewAssigned: (serviceOrderTitle: string, role: string) => ({
    type: "serviceOrder.assigned" as NotificationType,
    title: "Asignación de faena",
    body: `Fuiste asignado como ${role} en "${serviceOrderTitle}".`,
  }),
};
