import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  getQuote,
} from "./quoteService";

export const deleteQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "quote.delete", { companyId });

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
      throw new HttpsError("failed-precondition", "No se puede eliminar una cotización ya aceptada");
    }

    const now = new Date().toISOString();
    await db.runTransaction(async (t) => {
      t.delete(companyRef(companyId).collection("quotes").doc(quoteId));
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "quote.deleted",
        quoteId,
        message: `Cotización ${quote.quoteNumber || quoteId} eliminada`,
        userId: request.auth!.uid,
        metadata: { quoteNumber: quote.quoteNumber },
        createdAt: now,
      });
    });

    return { id: quoteId, deleted: true };
  }
);
