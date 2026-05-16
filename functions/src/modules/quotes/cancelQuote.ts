import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  companyRef,
  getQuote,
} from "./quoteService";

export const cancelQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const quoteId = cleanString(request.data?.quoteId);
    if (!quoteId) {
      throw new HttpsError("invalid-argument", "quoteId es obligatorio");
    }

    const quote = await getQuote(companyId, quoteId);
    if (!quote) {
      throw new HttpsError("not-found", "Cotización no encontrada");
    }
    if (cleanString(quote.companyId) && cleanString(quote.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta cotización");
    }

    const currentStatus = cleanString(quote.status);
    if (currentStatus === "accepted") {
      throw new HttpsError("failed-precondition", "No se puede cancelar una cotización ya aceptada");
    }

    const now = new Date().toISOString();
    await db.runTransaction(async (t) => {
      t.update(companyRef(companyId).collection("quotes").doc(quoteId), {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        updatedBy: request.auth!.uid,
      });
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "quote.cancelled",
        quoteId,
        message: `Cotización ${quote.quoteNumber} cancelada`,
        userId: request.auth!.uid,
        metadata: { quoteNumber: quote.quoteNumber },
        createdAt: now,
      });
    });

    return { id: quoteId, status: "cancelled" };
  }
);
