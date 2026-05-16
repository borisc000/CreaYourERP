import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  getQuote,
} from "./quoteService";

export const acceptQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "quote.accept", { companyId });

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
    if (currentStatus !== "sent") {
      throw new HttpsError("failed-precondition", `No se puede aceptar una cotización en estado ${currentStatus}`);
    }

    const now = new Date().toISOString();
    await db.runTransaction(async (t) => {
      t.update(companyRef(companyId).collection("quotes").doc(quoteId), {
        status: "accepted",
        acceptedAt: now,
        updatedAt: now,
        updatedBy: request.auth!.uid,
      });
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "quote.accepted",
        quoteId,
        message: `Cotización ${quote.quoteNumber} aceptada`,
        userId: request.auth!.uid,
        metadata: { quoteNumber: quote.quoteNumber },
        createdAt: now,
      });
    });

    // Nota: Los side effects (crear ServiceOrder, avanzar lead, etc.)
    // los maneja el trigger onQuoteAccepted existente.

    return { id: quoteId, status: "accepted" };
  }
);
